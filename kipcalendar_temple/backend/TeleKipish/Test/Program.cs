// ============================================================================
// Program.cs - Точка входа приложения
// ============================================================================
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TeleKipish.Bot;
using TeleKipish.Services;
using TeleKipish.Database;

namespace TeleKipish;

public class Program
{
    public static async Task Main(string[] args)
    {
        var host = Host.CreateDefaultBuilder(args)
            .ConfigureServices((context, services) =>
            {
                // Конфигурация
                var config = new BotConfig();
                services.AddSingleton(config);

                // Database
                services.AddSingleton<DatabaseService>();

                // Services
                services.AddSingleton<ApiService>();
                services.AddSingleton<AuthService>();
                services.AddSingleton<UserService>();
                services.AddSingleton<EventService>();
                services.AddSingleton<GradeService>();
                services.AddSingleton<AttendanceService>();
                services.AddSingleton<NotificationService>();
                services.AddSingleton<QRCodeService>();

                // Bot
                services.AddSingleton<BotClient>();
                services.AddSingleton<CommandHandler>();
                services.AddHostedService<BotHostedService>();
            })
            .ConfigureLogging(logging =>
            {
                logging.ClearProviders();
                logging.AddConsole();
                logging.SetMinimumLevel(LogLevel.Information);
            })
            .Build();

        await host.RunAsync();
    }
}