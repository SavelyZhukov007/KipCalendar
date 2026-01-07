using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TeleKipish.Bot;
using TeleKipish.Services;
using TeleKipish.Database;
using TeleKipish.Helpers;
using TeleKipish.Models;

namespace TeleKipish
{
    class Program
    {
        static async Task Main(string[] args)
        {
            var host = Host.CreateDefaultBuilder(args)
                .ConfigureAppConfiguration((context, config) =>
                {
                    config.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
                    config.AddEnvironmentVariables();
                })
                .ConfigureServices((context, services) =>
                {
                    // Configuration
                    var configuration = context.Configuration;
                    services.AddSingleton<IConfiguration>(configuration);

                    // Helpers.Config instance
                    services.AddSingleton<TeleKipish.Helpers.Config>(new TeleKipish.Helpers.Config(configuration));

                    // Database
                    services.AddSingleton<DatabaseService>();

                    // Helpers
                    services.AddSingleton<Logger>();
                    services.AddSingleton<TokenHelper>();
                    services.AddSingleton<QRCodeHelper>();
                    services.AddSingleton<DateTimeHelper>();
                    services.AddSingleton<ApiClient>();

                    // Services
                    services.AddSingleton<UserService>();
                    services.AddSingleton<ScheduleService>();
                    services.AddSingleton<GradeService>();
                    services.AddSingleton<AttendanceService>();
                    services.AddSingleton<HomeworkService>();
                    services.AddSingleton<CalendarService>();
                    services.AddSingleton<NotificationService>();

                    // Bot Components
                    services.AddSingleton<BotClient>();
                    services.AddSingleton<CommandHandler>();
                    services.AddSingleton<AuthService>();
                    services.AddSingleton<LocalizationService>();
                    services.AddSingleton<InlineKeyboardBuilder>();

                    // Hosted Services
                    services.AddHostedService<NotificationBackgroundService>();
                    services.AddHostedService<CleanupBackgroundService>();
                })
                .ConfigureLogging((context, logging) =>
                {
                    logging.ClearProviders();
                    logging.AddConsole();
                    logging.AddDebug();
                    logging.SetMinimumLevel(LogLevel.Information);
                })
                .Build();

            // Initialize database
            var dbService = host.Services.GetRequiredService<DatabaseService>();
            await dbService.InitializeDatabaseAsync();

            // Start the bot
            var botClient = host.Services.GetRequiredService<BotClient>();
            await botClient.StartAsync();

            // Run the host
            await host.RunAsync();
        }
    }
}