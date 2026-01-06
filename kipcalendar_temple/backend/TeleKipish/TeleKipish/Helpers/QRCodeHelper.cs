using QRCoder;
using System.Drawing;
using System.Drawing.Imaging;

namespace TeleKipish.Helpers
{
    public class QRCodeHelper
    {
        private readonly Config _config;

        public QRCodeHelper(Config config)
        {
            _config = config;
        }

        public byte[] GenerateQRCodeImage(string data, int pixelsPerModule = 20)
        {
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(data, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new QRCode(qrCodeData);

            using var qrCodeImage = qrCode.GetGraphic(pixelsPerModule);

            using var ms = new MemoryStream();
            qrCodeImage.Save(ms, ImageFormat.Png);
            return ms.ToArray();
        }

        public string GenerateAttendanceQRData(string token, string baseUrl)
        {
            return $"{baseUrl}/qr-attendance?token={token}";
        }

        public string GenerateQRCodeText(string token)
        {
            // Simple text representation for debugging
            return $"QR Token: {token}\nExpires: {DateTime.UtcNow.AddMinutes(_config.QRTokenExpiryMinutes):HH:mm} UTC";
        }

        public string FormatQRMessage(string token, DateTime expiresAt)
        {
            var timeLeft = expiresAt - DateTime.UtcNow;
            var minutesLeft = (int)timeLeft.TotalMinutes;

            return $"📱 QR-код для отметки присутствия\n\n" +
                   $"🔑 Код: `{token}`\n" +
                   $"⏰ Действует: {minutesLeft} минут\n" +
                   $"🕒 Истекает: {expiresAt:HH:mm}\n\n" +
                   $"Студенты могут отсканировать QR-код или отправить команду:\n" +
                   $"`/scan {token}`";
        }
    }
}