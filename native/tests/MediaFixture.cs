using System.Text.Json;
using System.Windows.Forms;
using Windows.Media;
using Windows.Media.Control;

namespace Sapphire.Native.Tests;

// Real Windows SMTC registration and transport events. No audible playback or personal sessions.
internal static class MediaFixture
{
    [STAThread]
    public static int Main()
    {
        using var window = new Form { ShowInTaskbar = false, Text = "Sapphire owned SMTC fixture" };
        var controls = SystemMediaTransportControlsInterop.GetForWindow(window.Handle);
        var uniqueTitle = "Sapphire native fixture " + Guid.NewGuid().ToString("N");
        var position = TimeSpan.FromSeconds(27);
        var received = 0;
        void Timeline() => controls.UpdateTimelineProperties(new SystemMediaTransportControlsTimelineProperties { StartTime = TimeSpan.FromSeconds(15), EndTime = TimeSpan.FromSeconds(135), MinSeekTime = TimeSpan.FromSeconds(20), MaxSeekTime = TimeSpan.FromSeconds(125), Position = position });
        controls.IsPlayEnabled = true;
        controls.IsPauseEnabled = true;
        controls.IsNextEnabled = true;
        controls.IsPreviousEnabled = true;
        controls.DisplayUpdater.Type = MediaPlaybackType.Music;
        controls.DisplayUpdater.MusicProperties.Title = uniqueTitle;
        controls.DisplayUpdater.MusicProperties.Artist = "Owned test fixture";
        controls.DisplayUpdater.MusicProperties.AlbumTitle = "Windows native protocol verification";
        controls.DisplayUpdater.Update();
        controls.ButtonPressed += (_, args) =>
        {
            if (args.Button == SystemMediaTransportControlsButton.Play) controls.PlaybackStatus = MediaPlaybackStatus.Playing;
            if (args.Button == SystemMediaTransportControlsButton.Pause) controls.PlaybackStatus = MediaPlaybackStatus.Paused;
            Interlocked.Increment(ref received);
            Timeline();
        };
        controls.PlaybackPositionChangeRequested += (_, args) =>
        {
            position = args.RequestedPlaybackPosition;
            Interlocked.Increment(ref received);
            Timeline();
        };
        controls.PlaybackStatus = MediaPlaybackStatus.Playing;
        Timeline();
        controls.IsEnabled = true;
        var outcome = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        window.BeginInvoke(async () =>
        {
            try
            {
                var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(8));
                GlobalSystemMediaTransportControlsSession? owned = null;
                var deadline = DateTime.UtcNow.AddSeconds(12);
                while (owned == null && DateTime.UtcNow < deadline)
                {
                    foreach (var candidate in manager.GetSessions())
                    {
                        var properties = await candidate.TryGetMediaPropertiesAsync();
                        if (properties.Title == uniqueTitle) { owned = candidate; break; }
                    }
                    if (owned == null) await Task.Delay(100);
                }
                if (owned == null) throw new Exception("Windows did not expose the owned SMTC session to GSMTC.");
                var media = new MediaServices(owned);
                var checks = 0;
                async Task<JsonElement> Read() => JsonSerializer.SerializeToElement(await media.Get());
                async Task WaitFor(Func<JsonElement, bool> predicate)
                {
                    var deadline = DateTime.UtcNow.AddSeconds(5);
                    do { if (predicate(await Read())) return; await Task.Delay(100); } while (DateTime.UtcNow < deadline);
                    throw new Exception("Owned media state did not update after the Windows transport command.");
                }
                var data = await Read();
                if (data.GetProperty("title").GetString() != uniqueTitle || data.GetProperty("artist").GetString() != "Owned test fixture") throw new Exception("Metadata readback failed.");
                checks++;
                if (Math.Abs(data.GetProperty("duration").GetDouble() - 120) > 0.01 || Math.Abs(data.GetProperty("currentTime").GetDouble() - 12) > 0.01) throw new Exception("Timeline readback failed.");
                checks++;
                using (var pause = JsonDocument.Parse("{\"action\":\"pause\"}")) await media.Control(pause.RootElement);
                await WaitFor(value => !value.GetProperty("isPlaying").GetBoolean());
                checks++;
                using (var play = JsonDocument.Parse("{\"action\":\"play\"}")) await media.Control(play.RootElement);
                await WaitFor(value => value.GetProperty("isPlaying").GetBoolean());
                checks++;
                using (var seek = JsonDocument.Parse("{\"action\":\"seek\",\"position\":37}")) await media.Control(seek.RootElement);
                await WaitFor(value => Math.Abs(value.GetProperty("currentTime").GetDouble() - 37) < 0.01);
                checks++;
                if (position != TimeSpan.FromSeconds(52)) throw new Exception("Relative seek did not include the timeline's 15-second offset.");
                checks++;
                var beforeRejected = Volatile.Read(ref received);
                foreach (var rejectedPosition in new[] { 121, 1, 115 })
                {
                    using var invalidSeek = JsonDocument.Parse(JsonSerializer.Serialize(new { action = "seek", position = rejectedPosition }));
                    try { await media.Control(invalidSeek.RootElement); throw new Exception("Out-of-range seek was accepted."); }
                    catch (NativeError error) when (error.Code == "invalid_request") { checks++; }
                }
                if (Volatile.Read(ref received) != beforeRejected) throw new Exception("An out-of-range seek reached the owned player.");
                if (Volatile.Read(ref received) < 3) throw new Exception("Windows transport events did not reach the owned fixture.");
                checks++;
                Console.WriteLine(JsonSerializer.Serialize(new { ok = true, checks, fixture = "owned hidden SMTC window", metadata = true, timeline = true, play = true, pause = true, seek = true, personalSessionsControlled = false }));
                outcome.SetResult(0);
            }
            catch (Exception ex) { Console.Error.WriteLine(ex); outcome.SetResult(1); }
            finally { Application.ExitThread(); }
        });
        try { Application.Run(); return outcome.Task.GetAwaiter().GetResult(); }
        finally { controls.IsEnabled = false; controls.PlaybackStatus = MediaPlaybackStatus.Closed; controls.DisplayUpdater.ClearAll(); controls.DisplayUpdater.Update(); }
    }
}
