// ============================================================================
// Services/ApiService.cs - Базовый сервис для работы с API
// ============================================================================
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using TeleKipish.Bot;
using TeleKipish.Models;
using TeleKipish.TeleKipish.Bot;

namespace TeleKipish.Services;

public class ApiService
{
    private readonly HttpClient _httpClient;
    private readonly BotConfig _config;
    private readonly ILogger<ApiService> _logger;
    private readonly Dictionary<long, string> _tokenCache = new();

    public ApiService(BotConfig config, ILogger<ApiService> logger)
    {
        _config = config;
        _logger = logger;
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(config.ApiBaseUrl)
        };
    }

    public async Task<T?> GetAsync<T>(string endpoint, long? telegramId = null)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, endpoint);

            if (telegramId.HasValue)
            {
                var token = await GetTokenAsync(telegramId.Value);
                if (!string.IsNullOrEmpty(token))
                {
                    request.Headers.Add("X-Telegram-Token", token);
                }
            }

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning($"GET {endpoint} failed with status {response.StatusCode}");
                return default;
            }

            return await response.Content.ReadFromJsonAsync<T>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error GET {endpoint}");
            return default;
        }
    }

    public async Task<T?> PostAsync<T>(string endpoint, object data, long? telegramId = null)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(data),
                    Encoding.UTF8,
                    "application/json")
            };

            if (telegramId.HasValue)
            {
                var token = await GetTokenAsync(telegramId.Value);
                if (!string.IsNullOrEmpty(token))
                {
                    request.Headers.Add("X-Telegram-Token", token);
                }
            }

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"POST {endpoint} failed: {error}");
                return default;
            }

            return await response.Content.ReadFromJsonAsync<T>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error POST {endpoint}");
            return default;
        }
    }

    public async Task<bool> PostAsync(string endpoint, object data, long? telegramId = null)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(data),
                    Encoding.UTF8,
                    "application/json")
            };

            if (telegramId.HasValue)
            {
                var token = await GetTokenAsync(telegramId.Value);
                if (!string.IsNullOrEmpty(token))
                {
                    request.Headers.Add("X-Telegram-Token", token);
                }
            }

            var response = await _httpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error POST {endpoint}");
            return false;
        }
    }

    private async Task<string?> GetTokenAsync(long telegramId)
    {
        // Проверяем кэш
        if (_tokenCache.TryGetValue(telegramId, out var cachedToken))
        {
            return cachedToken;
        }

        try
        {
            // Генерируем новый токен
            var response = await PostAsync<TokenResponse>(
                "/telegram/token/generate",
                new { telegram_id = telegramId.ToString() }
            );

            if (response?.Token != null)
            {
                _tokenCache[telegramId] = response.Token;
                return response.Token;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting token");
        }

        return null;
    }

    public void ClearTokenCache(long telegramId)
    {
        _tokenCache.Remove(telegramId);
    }
}





