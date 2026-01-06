using TeleKipish.Database;
using TeleKipish.Helpers;
using TeleKipish.Models;
using TeleKipish.Services;
using Microsoft.EntityFrameworkCore;

namespace TeleKipish.Bot
{
    public class AuthService
    {
        private readonly DatabaseService _db;
        private readonly Logger _logger;
        private readonly TokenHelper _tokenHelper;
        private readonly ApiClient _apiClient;
        private readonly UserService _userService;

        public AuthService(DatabaseService db, Logger logger, TokenHelper tokenHelper, ApiClient apiClient, UserService userService)
        {
            _db = db;
            _logger = logger;
            _tokenHelper = tokenHelper;
            _apiClient = apiClient;
            _userService = userService;
        }

        public async Task<string> GenerateLinkCode(string telegramId)
        {
            try
            {
                // Check if user already has an active link code
                var existingLink = await _db.Context.TelegramLinks
                    .FirstOrDefaultAsync(l => l.TelegramId == telegramId &&
                                              !l.IsUsed &&
                                              l.ExpiresAt > DateTime.UtcNow);

                if (existingLink != null)
                {
                    return existingLink.LinkCode;
                }

                // Generate new link code
                var linkCode = _tokenHelper.GenerateLinkCode();
                var expiresAt = _tokenHelper.CalculateLinkCodeExpiry();

                var telegramLink = new TelegramLink
                {
                    LinkCode = linkCode,
                    TelegramId = telegramId,
                    GeneratedAt = DateTime.UtcNow,
                    ExpiresAt = expiresAt,
                    IsUsed = false
                };

                await _db.Context.TelegramLinks.AddAsync(telegramLink);
                await _db.Context.SaveChangesAsync();

                _logger.LogInformation($"Generated link code {linkCode} for Telegram ID {telegramId}");

                return linkCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating link code for Telegram ID {telegramId}");
                throw;
            }
        }

        public async Task<bool> ValidateLinkCode(string telegramId, string linkCode)
        {
            try
            {
                var telegramLink = await _db.Context.TelegramLinks
                    .FirstOrDefaultAsync(l => l.LinkCode == linkCode &&
                                              !l.IsUsed &&
                                              l.ExpiresAt > DateTime.UtcNow);

                if (telegramLink == null)
                    return false;

                // Check if code is already linked to another Telegram account
                if (!string.IsNullOrEmpty(telegramLink.TelegramId) && telegramLink.TelegramId != telegramId)
                    return false;

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error validating link code {linkCode} for Telegram ID {telegramId}");
                return false;
            }
        }

        public async Task<bool> LinkAccount(string telegramId, string linkCode, int kipCalendarUserId)
        {
            try
            {
                var telegramLink = await _db.Context.TelegramLinks
                    .FirstOrDefaultAsync(l => l.LinkCode == linkCode &&
                                              !l.IsUsed &&
                                              l.ExpiresAt > DateTime.UtcNow);

                if (telegramLink == null)
                    return false;

                // Update Telegram link
                telegramLink.TelegramId = telegramId;
                telegramLink.KipCalendarUserId = kipCalendarUserId;
                telegramLink.IsUsed = true;
                telegramLink.UsedAt = DateTime.UtcNow;

                // Get or create user
                var user = await _userService.GetUserByTelegramId(telegramId);
                if (user == null)
                {
                    // Create user record if it doesn't exist
                    user = await _userService.CreateOrUpdateUser(telegramId, null, null, null);
                }

                if (user != null)
                {
                    user.KipCalendarUserId = kipCalendarUserId;
                    _db.Context.Users.Update(user);
                }

                // Create notification settings for user
                var notificationSettings = new NotificationSettings
                {
                    UserId = user?.Id ?? 0,
                    TelegramId = telegramId,
                    IsActive = true,
                    Language = user?.Language ?? "ru",
                    Format = "detailed",
                    CreatedAt = DateTime.UtcNow,
                    LastActive = DateTime.UtcNow
                };

                await _db.Context.NotificationSettings.AddAsync(notificationSettings);

                await _db.Context.SaveChangesAsync();

                // Call API to link accounts
                await _apiClient.LinkTelegramAccount(telegramId, kipCalendarUserId);

                _logger.LogInformation($"Linked Telegram ID {telegramId} to KipCalendar user {kipCalendarUserId}");

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error linking account for Telegram ID {telegramId} with code {linkCode}");
                return false;
            }
        }

        public async Task<bool> UnlinkAccount(string telegramId)
        {
            try
            {
                var user = await _userService.GetUserByTelegramId(telegramId);
                if (user == null)
                    return false;

                // Clear KipCalendar user ID
                user.KipCalendarUserId = null;
                _db.Context.Users.Update(user);

                // Deactivate notification settings
                var notificationSettings = await _db.Context.NotificationSettings
                    .FirstOrDefaultAsync(s => s.TelegramId == telegramId);

                if (notificationSettings != null)
                {
                    notificationSettings.IsActive = false;
                    _db.Context.NotificationSettings.Update(notificationSettings);
                }

                // Deactivate Telegram tokens
                var tokens = await _db.Context.TelegramTokens
                    .Where(t => t.UserId == user.Id && t.IsActive)
                    .ToListAsync();

                foreach (var token in tokens)
                {
                    token.IsActive = false;
                }

                if (tokens.Any())
                {
                    _db.Context.TelegramTokens.UpdateRange(tokens);
                }

                await _db.Context.SaveChangesAsync();

                // Call API to unlink account
                await _apiClient.UnlinkTelegramAccount(telegramId);

                _logger.LogInformation($"Unlinked Telegram ID {telegramId}");

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error unlinking account for Telegram ID {telegramId}");
                return false;
            }
        }

        public async Task<bool> UpdateUserActivity(string telegramId)
        {
            return await _userService.UpdateUserActivity(telegramId);
        }

        public async Task<bool> IsAccountLinked(string telegramId)
        {
            try
            {
                var user = await _userService.GetUserByTelegramId(telegramId);
                return user?.KipCalendarUserId != null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error checking if account is linked for Telegram ID {telegramId}");
                return false;
            }
        }

        public async Task<TelegramToken?> GenerateApiToken(string telegramId)
        {
            try
            {
                var user = await _userService.GetUserByTelegramId(telegramId);
                if (user == null || user.KipCalendarUserId == null)
                    return null;

                // Deactivate existing tokens
                var existingTokens = await _db.Context.TelegramTokens
                    .Where(t => t.UserId == user.Id && t.IsActive)
                    .ToListAsync();

                foreach (var token in existingTokens)
                {
                    token.IsActive = false;
                }

                if (existingTokens.Any())
                {
                    _db.Context.TelegramTokens.UpdateRange(existingTokens);
                }

                // Generate new token
                var tokenString = _tokenHelper.GenerateApiToken();
                var expiresAt = _tokenHelper.CalculateTokenExpiry(30);

                var telegramToken = new TelegramToken
                {
                    UserId = user.Id,
                    Token = _tokenHelper.HashToken(tokenString),
                    CreatedAt = DateTime.UtcNow,
                    ExpiresAt = expiresAt,
                    IsActive = true
                };

                await _db.Context.TelegramTokens.AddAsync(telegramToken);
                await _db.Context.SaveChangesAsync();

                // Return token with unhashed value for initial use
                telegramToken.Token = tokenString;

                _logger.LogInformation($"Generated API token for user {user.Id}");

                return telegramToken;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating API token for Telegram ID {telegramId}");
                return null;
            }
        }

        public async Task<bool> ValidateApiToken(string token, string? telegramId = null)
        {
            try
            {
                var hashedToken = _tokenHelper.HashToken(token);

                var query = _db.Context.TelegramTokens
                    .Include(t => t.User)
                    .Where(t => t.Token == hashedToken &&
                                t.IsActive &&
                                t.ExpiresAt > DateTime.UtcNow);

                if (!string.IsNullOrEmpty(telegramId))
                {
                    query = query.Where(t => t.User!.TelegramId == telegramId);
                }

                var telegramToken = await query.FirstOrDefaultAsync();

                if (telegramToken == null)
                    return false;

                // Update last used timestamp
                telegramToken.LastUsed = DateTime.UtcNow;
                telegramToken.LastUsedFrom = "API";

                _db.Context.TelegramTokens.Update(telegramToken);
                await _db.Context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error validating API token");
                return false;
            }
        }

        public async Task<bool> CleanupExpiredTokens()
        {
            try
            {
                var expiredTokens = await _db.Context.TelegramTokens
                    .Where(t => t.ExpiresAt <= DateTime.UtcNow && t.IsActive)
                    .ToListAsync();

                if (expiredTokens.Any())
                {
                    foreach (var token in expiredTokens)
                    {
                        token.IsActive = false;
                    }

                    _db.Context.TelegramTokens.UpdateRange(expiredTokens);
                    await _db.Context.SaveChangesAsync();

                    _logger.LogInformation($"Deactivated {expiredTokens.Count} expired tokens");
                }

                // Cleanup unused link codes
                var expiredLinks = await _db.Context.TelegramLinks
                    .Where(l => l.ExpiresAt <= DateTime.UtcNow && !l.IsUsed)
                    .ToListAsync();

                if (expiredLinks.Any())
                {
                    _db.Context.TelegramLinks.RemoveRange(expiredLinks);
                    await _db.Context.SaveChangesAsync();

                    _logger.LogInformation($"Cleaned up {expiredLinks.Count} expired link codes");
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cleaning up expired tokens");
                return false;
            }
        }
    }
}