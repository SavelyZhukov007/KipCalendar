using Microsoft.Extensions.Hosting;
using System.Threading;
using System.Threading.Tasks;

namespace TeleKipish.Services
{
    public class CleanupBackgroundService : BackgroundService
    {
        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Stub background task
            return Task.CompletedTask;
        }
    }
}
