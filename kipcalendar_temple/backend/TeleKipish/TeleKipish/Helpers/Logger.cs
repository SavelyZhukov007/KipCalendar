using Microsoft.Extensions.Logging;
using System.Text;

namespace TeleKipish.Helpers
{
    public class Logger
    {
        private readonly ILogger<Logger> _logger;
        private readonly string _logDirectory;

        public Logger(ILogger<Logger> logger)
        {
            _logger = logger;
            _logDirectory = Path.Combine(Directory.GetCurrentDirectory(), "logs");

            if (!Directory.Exists(_logDirectory))
            {
                Directory.CreateDirectory(_logDirectory);
            }
        }

        public void LogInformation(string message, params object[] args)
        {
            _logger.LogInformation(message, args);
            WriteToFile("INFO", message, args);
        }

        public void LogWarning(string message, params object[] args)
        {
            _logger.LogWarning(message, args);
            WriteToFile("WARN", message, args);
        }

        public void LogError(string message, params object[] args)
        {
            _logger.LogError(message, args);
            WriteToFile("ERROR", message, args);
        }

        public void LogError(Exception ex, string message, params object[] args)
        {
            _logger.LogError(ex, message, args);
            WriteToFile("ERROR", $"{message} - Exception: {ex.Message}\nStackTrace: {ex.StackTrace}", args);
        }

        public void LogDebug(string message, params object[] args)
        {
            _logger.LogDebug(message, args);
            WriteToFile("DEBUG", message, args);
        }

        private void WriteToFile(string level, string message, params object[] args)
        {
            try
            {
                var formattedMessage = args.Length > 0 ? string.Format(message, args) : message;
                var logEntry = $"{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} [{level}] {formattedMessage}";

                var logFile = Path.Combine(_logDirectory, $"telegram-bot-{DateTime.UtcNow:yyyy-MM-dd}.log");

                File.AppendAllText(logFile, logEntry + Environment.NewLine, Encoding.UTF8);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write to log file");
            }
        }

        public void LogCommand(string telegramId, string command, bool success, long executionTime, string? errorMessage = null)
        {
            var message = $"Command executed - User: {telegramId}, Command: {command}, Success: {success}, ExecutionTime: {executionTime}ms";
            if (!string.IsNullOrEmpty(errorMessage))
            {
                message += $", Error: {errorMessage}";
            }

            LogInformation(message);
        }
    }
}