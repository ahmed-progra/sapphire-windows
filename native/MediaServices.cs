using System.Text.Json;
using Windows.Media.Control;
using Windows.Storage.Streams;

namespace Sapphire.Native;

internal sealed class MediaServices
{
    private GlobalSystemMediaTransportControlsSessionManager? manager;
    private readonly GlobalSystemMediaTransportControlsSession? ownedTestSession;

    public MediaServices() { }
    // A fixture can bind directly to its own verified Windows session. IPC cannot select a session.
    internal MediaServices(GlobalSystemMediaTransportControlsSession ownedTestSession) => this.ownedTestSession = ownedTestSession;

    private async Task<GlobalSystemMediaTransportControlsSessionManager> Manager() => manager ??= await GlobalSystemMediaTransportControlsSessionManager.RequestAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(8));

    public async Task<bool> Available()
    {
        _ = await Manager();
        return true;
    }

    public async Task<object?> Get()
    {
        var session = ownedTestSession ?? (await Manager()).GetCurrentSession();
        if (session == null) return null;
        var metadata = await session.TryGetMediaPropertiesAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(5));
        var timeline = session.GetTimelineProperties();
        var playback = session.GetPlaybackInfo();
        var duration = Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds);
        var currentTime = Math.Clamp((timeline.Position - timeline.StartTime).TotalSeconds, 0, duration);
        string? albumArt = null;
        if (metadata.Thumbnail != null)
        {
            try
            {
                using var stream = await metadata.Thumbnail.OpenReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(3));
                if (stream.Size <= 1024 * 1024)
                {
                    using var reader = new DataReader(stream);
                    await reader.LoadAsync((uint)stream.Size).AsTask().WaitAsync(TimeSpan.FromSeconds(3));
                    var bytes = new byte[stream.Size];
                    reader.ReadBytes(bytes);
                    albumArt = "data:" + (string.IsNullOrEmpty(stream.ContentType) ? "image/png" : stream.ContentType) + ";base64," + Convert.ToBase64String(bytes);
                }
            }
            catch (Exception ex) when (ex is TimeoutException or System.Runtime.InteropServices.COMException) { }
        }
        var controls = playback.Controls;
        return new { title = metadata.Title, artist = metadata.Artist, album = metadata.AlbumTitle, albumArt, duration, currentTime, isPlaying = playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing, volume = AudioServices.DefaultVolume(), volumeSource = "system-output", lyrics = Array.Empty<object>(), source = session.SourceAppUserModelId, controls = new { play = controls.IsPlayEnabled, pause = controls.IsPauseEnabled, next = controls.IsNextEnabled, previous = controls.IsPreviousEnabled, seek = controls.IsPlaybackPositionEnabled } };
    }

    public async Task<object> Control(JsonElement p)
    {
        var action = Parameters.Text(p, "action", 20);
        if (action is not ("toggle" or "play" or "pause" or "next" or "previous" or "seek")) throw new NativeError("invalid_request", "Unknown media action.");
        var position = action == "seek" ? Parameters.Number(p, "position", 0, 60 * 60 * 24 * 7) : 0;
        var session = ownedTestSession ?? (await Manager()).GetCurrentSession() ?? throw new NativeError("not_found", "No Windows media session is available.");
        var controls = session.GetPlaybackInfo().Controls;
        var allowed = action switch
        {
            "play" => controls.IsPlayEnabled,
            "pause" => controls.IsPauseEnabled,
            "next" => controls.IsNextEnabled,
            "previous" => controls.IsPreviousEnabled,
            "seek" => controls.IsPlaybackPositionEnabled,
            _ => controls.IsPlayPauseToggleEnabled
        };
        if (!allowed) throw new NativeError("unsupported", "The current media application does not support this control.");
        long seekTicks = 0;
        if (action == "seek")
        {
            var timeline = session.GetTimelineProperties();
            var duration = (timeline.EndTime - timeline.StartTime).TotalSeconds;
            if (duration < 0 || position > duration) throw new NativeError("invalid_request", "The requested position is outside the current media timeline.");
            var target = timeline.StartTime + TimeSpan.FromSeconds(position);
            if (target < timeline.MinSeekTime || target > timeline.MaxSeekTime)
                throw new NativeError("invalid_request", "The media application does not allow seeking to that position in its current seek range.");
            seekTicks = target.Ticks;
        }
        var operation = action switch
        {
            "play" => session.TryPlayAsync(),
            "pause" => session.TryPauseAsync(),
            "next" => session.TrySkipNextAsync(),
            "previous" => session.TrySkipPreviousAsync(),
            "seek" => session.TryChangePlaybackPositionAsync(seekTicks),
            _ => session.TryTogglePlayPauseAsync()
        };
        var success = await operation.AsTask().WaitAsync(TimeSpan.FromSeconds(5));
        if (!success) throw new NativeError("rejected", "The media application rejected this control.");
        return new { success };
    }
}
