// ============================================================================
// Services/AuthService.cs - Сервис аутентификации
// ============================================================================
using Microsoft.Extensions.Logging;
using TeleKipish.Models;
using TeleKipish.Services.TeleKipish.Services.TeleKipish.Models;

namespace TeleKipish.Services;

public class AuthService
{
    private readonly ApiService _apiService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(ApiService apiService, ILogger<AuthService> logger)
    {
        _apiService = apiService;
        _logger = logger;
    }

    public async Task<bool> IsUserLinkedAsync(long telegramId)
    {
        try
        {
            var response = await _apiService.GetAsync<LinkStatusResponse>(
                $"/telegram/link/status?telegram_id={telegramId}"
            );

            return response?.IsLinked ?? false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking link status");
            return false;
        }
    }

    public async Task<LinkResult> LinkAccountAsync(long telegramId, string code)
    {
        try
        {
            var response = await _apiService.PostAsync<LinkCompleteResponse>(
                "/telegram/link/complete",
                new
                {
                    telegram_id = telegramId.ToString(),
                    link_code = code
                }
            );

            if (response?.Success == true)
            {
                return new LinkResult
                {
                    Success = true,
                    UserId = response.UserId,
                    Message = "Аккаунт успешно связан"
                };
            }

            return new LinkResult
            {
                Success = false,
                Message = response?.Error ?? "Неизвестная ошибка"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error linking account");
            return new LinkResult
            {
                Success = false,
                Message = "Ошибка при связывании аккаунта"
            };
        }
    }

    public async Task<bool> UnlinkAccountAsync(long telegramId)
    {
        try
        {
            var result = await _apiService.PostAsync(
                "/telegram/unlink",
                new { telegram_id = telegramId.ToString() }
            );

            if (result)
            {
                _apiService.ClearTokenCache(telegramId);
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unlinking account");
            return false;
        }
    }
}