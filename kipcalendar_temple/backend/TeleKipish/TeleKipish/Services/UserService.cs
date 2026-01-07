using System.Threading.Tasks;

namespace TeleKipish.Services
{
    public class UserService
    {
        public Task<Models.User?> GetUserByTelegramId(string telegramId)
        {
            // Minimal stub - real implementation should query DB
            return Task.FromResult<Models.User?>(null);
        }

        public Task<Models.User> CreateOrUpdateUser(string telegramId, string? firstName, string? lastName, string? username)
        {
            // Minimal stub: create a new User object
            var user = new Models.User
            {
                TelegramId = telegramId,
                FirstName = firstName,
                LastName = lastName,
                Username = username
            };
            return Task.FromResult(user);
        }

        public Task<bool> UpdateUserActivity(string telegramId)
        {
            // Stub
            return Task.FromResult(true);
        }
    }
}
