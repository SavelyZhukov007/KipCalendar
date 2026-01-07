using TeleKipish.Database;
using TeleKipish.Helpers;
using TeleKipish.Models;
using TeleKipish.Services;

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

        public Task<string> GenerateLinkCode(string telegramId)
        {
            // Delegate to TokenHelper for simplicity
            var code = _tokenHelper.GenerateLinkCode();
            return Task.FromResult(code);
        }

        public Task<bool> ValidateLinkCode(string telegramId, string linkCode)
        {
            // Stub validation
            return Task.FromResult(true);
        }

        public Task<bool> LinkAccount(string telegramId, string linkCode, int kipCalendarUserId)
        {
            // Stub linking
            return Task.FromResult(true);
        }

        public Task<bool> UnlinkAccount(string telegramId)
        {
            // Stub unlink
            return Task.FromResult(true);
        }

        public Task<bool> UpdateUserActivity(string telegramId)
        {
            return _userService.UpdateUserActivity(telegramId);
        }

        public Task<bool> IsAccountLinked(string telegramId)
        {
            return Task.FromResult(false);
        }

        public Task<TelegramToken?> GenerateApiToken(string telegramId)
        {
            return Task.FromResult<TelegramToken?>(null);
        }

        public Task<bool> ValidateApiToken(string token, string? telegramId = null)
        {
            return Task.FromResult(true);
        }

        public Task<bool> CleanupExpiredTokens()
        {
            return Task.FromResult(true);
        }
    }
}