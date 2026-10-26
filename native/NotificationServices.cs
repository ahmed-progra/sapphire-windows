using Windows.UI.Notifications;
using Windows.UI.Notifications.Management;

namespace Sapphire.Native;

internal static class NotificationServices
{
    public static object Capability()
    {
        try
        {
            var status = UserNotificationListener.Current.GetAccessStatus();
            return new { available = status == UserNotificationListenerAccessStatus.Allowed, reason = status == UserNotificationListenerAccessStatus.Allowed ? null : "Notification access requires an installed package and your permission.", status = status.ToString() };
        }
        catch (Exception ex) { return new { available = false, reason = "Windows notification listener is unavailable: " + ex.Message, status = "Unavailable" }; }
    }

    public static Task<object> RequestAccess() => OnUiThread<object>(async () =>
    {
        var status = await UserNotificationListener.Current.RequestAccessAsync().AsTask().WaitAsync(TimeSpan.FromMinutes(2));
        return new { allowed = status == UserNotificationListenerAccessStatus.Allowed, status = status.ToString() };
    });

    public static async Task<object> List()
    {
        var listener = UserNotificationListener.Current;
        var status = listener.GetAccessStatus();
        if (status != UserNotificationListenerAccessStatus.Allowed) throw new NativeError("permission_required", "Enable Windows notification access in Sapphire settings first.");
        var notifications = await listener.GetNotificationsAsync(NotificationKinds.Toast).AsTask().WaitAsync(TimeSpan.FromSeconds(8));
        return notifications.OrderByDescending(n => n.CreationTime).Take(100).Select(n =>
        {
            var text = n.Notification.Visual.Bindings.SelectMany(b => b.GetTextElements()).Select(t => t.Text).Where(t => !string.IsNullOrWhiteSpace(t)).ToArray();
            return new { id = n.Id, app = n.AppInfo?.DisplayInfo?.DisplayName ?? "Application", title = text.FirstOrDefault() ?? "Notification", body = string.Join("\n", text.Skip(1)), timestamp = n.CreationTime.ToString("O") };
        }).ToArray();
    }

    private static Task<T> OnUiThread<T>(Func<Task<T>> action)
    {
        var result = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() =>
        {
            try
            {
                using var control = new System.Windows.Forms.Control();
                _ = control.Handle;
                control.BeginInvoke(async () =>
                {
                    try { result.SetResult(await action()); }
                    catch (Exception ex) { result.SetException(ex); }
                    finally { System.Windows.Forms.Application.ExitThread(); }
                });
                System.Windows.Forms.Application.Run();
            }
            catch (Exception ex) { result.TrySetException(ex); }
        }) { IsBackground = true, Name = "Sapphire notification consent" };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        return result.Task;
    }
}
