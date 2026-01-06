using System.Security.Cryptography;
using System.Text;

namespace TeleKipish.Helpers
{
    public class TokenHelper
    {
        private readonly Random _random = new();
        private readonly Config _config;

        public TokenHelper(Config config)
        {
            _config = config;
        }

        public string GenerateLinkCode()
        {
            // Generate 6-digit numeric code
            return _random.Next(100000, 999999).ToString();
        }

        public string GenerateApiToken()
        {
            // Generate secure token for API authentication
            var bytes = new byte[32];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
        }

        public string GenerateQRToken()
        {
            // Generate token for QR code attendance
            var timestamp = DateTime.UtcNow.Ticks.ToString("x");
            var random = _random.Next(1000, 9999).ToString();
            return $"QR-{timestamp}-{random}";
        }

        public DateTime CalculateLinkCodeExpiry()
        {
            return DateTime.UtcNow.AddMinutes(_config.LinkCodeExpiryMinutes);
        }

        public DateTime CalculateQRTokenExpiry()
        {
            return DateTime.UtcNow.AddMinutes(_config.QRTokenExpiryMinutes);
        }

        public DateTime CalculateTokenExpiry(int days = 30)
        {
            return DateTime.UtcNow.AddDays(days);
        }

        public bool IsTokenExpired(DateTime expiresAt)
        {
            return DateTime.UtcNow > expiresAt;
        }

        public string HashToken(string token)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(token);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToBase64String(hash);
        }
    }
}