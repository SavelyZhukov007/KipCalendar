namespace TeleKipish.Models
{
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
        public string? Message { get; set; }
        public int StatusCode { get; set; }
    }

    public class ApiError
    {
        public string? ErrorCode { get; set; }
        public string? Message { get; set; }
        public Dictionary<string, string[]>? Details { get; set; }
    }
}