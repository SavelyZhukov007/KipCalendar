using RestSharp;
using Newtonsoft.Json;
using TeleKipish.Models;

namespace TeleKipish.Helpers
{
    public class ApiClient
    {
        private readonly RestClient _client;
        private readonly Config _config;
        private readonly Logger _logger;
        private readonly TokenHelper _tokenHelper;

        public ApiClient(Config config, Logger logger, TokenHelper tokenHelper)
        {
            _config = config;
            _logger = logger;
            _tokenHelper = tokenHelper;

            _client = new RestClient(_config.ApiBaseUrl);
            _client.Timeout = _config.ApiTimeoutSeconds * 1000;

            // Add default headers
            _client.AddDefaultHeader("Authorization", $"Bearer {_config.ApiKey}");
            _client.AddDefaultHeader("Content-Type", "application/json");
            _client.AddDefaultHeader("Accept", "application/json");
        }

        public async Task<ApiResponse<T>> GetAsync<T>(string endpoint, string? token = null)
        {
            try
            {
                var request = new RestRequest(endpoint, Method.GET);
                if (!string.IsNullOrEmpty(token))
                {
                    request.AddHeader("X-Telegram-Token", token);
                }

                var response = await _client.ExecuteAsync(request);

                if (response.IsSuccessful)
                {
                    var data = JsonConvert.DeserializeObject<T>(response.Content!);
                    return new ApiResponse<T>
                    {
                        Success = true,
                        Data = data,
                        StatusCode = (int)response.StatusCode
                    };
                }
                else
                {
                    _logger.LogError($"API GET error: {response.StatusCode} - {response.Content}");
                    return new ApiResponse<T>
                    {
                        Success = false,
                        Message = response.ErrorMessage ?? response.Content,
                        StatusCode = (int)response.StatusCode
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"API GET exception for endpoint: {endpoint}");
                return new ApiResponse<T>
                {
                    Success = false,
                    Message = ex.Message,
                    StatusCode = 500
                };
            }
        }

        public async Task<ApiResponse<T>> PostAsync<T>(string endpoint, object? data = null, string? token = null)
        {
            try
            {
                var request = new RestRequest(endpoint, Method.POST);
                if (!string.IsNullOrEmpty(token))
                {
                    request.AddHeader("X-Telegram-Token", token);
                }

                if (data != null)
                {
                    request.AddJsonBody(data);
                }

                var response = await _client.ExecuteAsync(request);

                if (response.IsSuccessful)
                {
                    var result = JsonConvert.DeserializeObject<T>(response.Content!);
                    return new ApiResponse<T>
                    {
                        Success = true,
                        Data = result,
                        StatusCode = (int)response.StatusCode
                    };
                }
                else
                {
                    _logger.LogError($"API POST error: {response.StatusCode} - {response.Content}");
                    return new ApiResponse<T>
                    {
                        Success = false,
                        Message = response.ErrorMessage ?? response.Content,
                        StatusCode = (int)response.StatusCode
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"API POST exception for endpoint: {endpoint}");
                return new ApiResponse<T>
                {
                    Success = false,
                    Message = ex.Message,
                    StatusCode = 500
                };
            }
        }

        public async Task<ApiResponse<T>> PutAsync<T>(string endpoint, object? data = null, string? token = null)
        {
            try
            {
                var request = new RestRequest(endpoint, Method.PUT);
                if (!string.IsNullOrEmpty(token))
                {
                    request.AddHeader("X-Telegram-Token", token);
                }

                if (data != null)
                {
                    request.AddJsonBody(data);
                }

                var response = await _client.ExecuteAsync(request);

                if (response.IsSuccessful)
                {
                    var result = JsonConvert.DeserializeObject<T>(response.Content!);
                    return new ApiResponse<T>
                    {
                        Success = true,
                        Data = result,
                        StatusCode = (int)response.StatusCode
                    };
                }
                else
                {
                    _logger.LogError($"API PUT error: {response.StatusCode} - {response.Content}");
                    return new ApiResponse<T>
                    {
                        Success = false,
                        Message = response.ErrorMessage ?? response.Content,
                        StatusCode = (int)response.StatusCode
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"API PUT exception for endpoint: {endpoint}");
                return new ApiResponse<T>
                {
                    Success = false,
                    Message = ex.Message,
                    StatusCode = 500
                };
            }
        }

        public async Task<ApiResponse<T>> DeleteAsync<T>(string endpoint, string? token = null)
        {
            try
            {
                var request = new RestRequest(endpoint, Method.DELETE);
                if (!string.IsNullOrEmpty(token))
                {
                    request.AddHeader("X-Telegram-Token", token);
                }

                var response = await _client.ExecuteAsync(request);

                if (response.IsSuccessful)
                {
                    var result = JsonConvert.DeserializeObject<T>(response.Content!);
                    return new ApiResponse<T>
                    {
                        Success = true,
                        Data = result,
                        StatusCode = (int)response.StatusCode
                    };
                }
                else
                {
                    _logger.LogError($"API DELETE error: {response.StatusCode} - {response.Content}");
                    return new ApiResponse<T>
                    {
                        Success = false,
                        Message = response.ErrorMessage ?? response.Content,
                        StatusCode = (int)response.StatusCode
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"API DELETE exception for endpoint: {endpoint}");
                return new ApiResponse<T>
                {
                    Success = false,
                    Message = ex.Message,
                    StatusCode = 500
                };
            }
        }

        // Specific API methods for KipCalendar
        public async Task<ApiResponse<string>> LinkTelegramAccount(string telegramId, int userId)
        {
            var data = new { telegramId, userId };
            return await PostAsync<string>("/api/telegram/link", data);
        }

        public async Task<ApiResponse<string>> UnlinkTelegramAccount(string telegramId)
        {
            var data = new { telegramId };
            return await PostAsync<string>("/api/telegram/unlink", data);
        }

        public async Task<ApiResponse<List<Notification>>> GetPendingNotifications(int userId, string? token = null)
        {
            return await GetAsync<List<Notification>>($"/api/notifications/pending/{userId}", token);
        }

        public async Task<ApiResponse<string>> MarkNotificationsSent(List<int> notificationIds, string? token = null)
        {
            var data = new { notificationIds };
            return await PostAsync<string>("/api/notifications/mark-telegram-sent", data, token);
        }

        public async Task<ApiResponse<dynamic>> GetUserProfile(int userId, string? token = null)
        {
            return await GetAsync<dynamic>($"/api/users/{userId}/profile", token);
        }

        public async Task<ApiResponse<dynamic>> GetSchedule(int groupId, string? token = null)
        {
            return await GetAsync<dynamic>($"/api/groups/{groupId}/schedule", token);
        }

        public async Task<ApiResponse<string>> GenerateQRAttendanceToken(int lessonId, int teacherId, string? token = null)
        {
            var data = new { lessonId, teacherId };
            return await PostAsync<string>("/api/qr-attendance/generate", data, token);
        }

        public async Task<ApiResponse<bool>> VerifyQRAttendanceToken(string qrToken, int studentId, string? token = null)
        {
            var data = new { token = qrToken, studentId };
            return await PostAsync<bool>("/api/qr-attendance/verify", data, token);
        }
    }
}