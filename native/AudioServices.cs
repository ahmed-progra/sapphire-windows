using System.Diagnostics;
using System.Text.Json;
using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;

namespace Sapphire.Native;

internal static class AudioServices
{
    public static double? DefaultVolume()
    {
        using var enumerator = new MMDeviceEnumerator();
        try { using var endpoint = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia); return endpoint.AudioEndpointVolume.MasterVolumeLevelScalar * 100; }
        catch (System.Runtime.InteropServices.COMException) { return null; }
    }

    public static object Get()
    {
        using var enumerator = new MMDeviceEnumerator();
        var sessions = new List<object>();
        var devices = new List<object>();
        string? defaultId = null;
        try { using var endpoint = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia); defaultId = endpoint.ID; } catch (System.Runtime.InteropServices.COMException) { }
        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
        {
            using (device)
            {
                devices.Add(new { id = device.ID, name = device.FriendlyName, isDefault = device.ID == defaultId, volume = device.AudioEndpointVolume.MasterVolumeLevelScalar, isMuted = device.AudioEndpointVolume.Mute });
                var manager = device.AudioSessionManager;
                try
                {
                    var collection = manager.Sessions;
                    for (var i = 0; i < collection.Count; i++)
                    {
                        using var session = collection[i];
                        if (session.State == AudioSessionState.AudioSessionStateExpired) continue;
                        var pid = session.GetProcessID;
                        var name = session.IsSystemSoundsSession ? "System sounds" : session.DisplayName;
                        if (string.IsNullOrWhiteSpace(name))
                        {
                            try { using var process = Process.GetProcessById((int)pid); name = process.ProcessName; }
                            catch (ArgumentException) { name = "Application " + pid; }
                        }
                        sessions.Add(new { id = SessionId(device, session), name, volume = session.SimpleAudioVolume.Volume, isMuted = session.SimpleAudioVolume.Mute, peakLevel = session.AudioMeterInformation.MasterPeakValue });
                    }
                }
                finally { manager.Dispose(); }
            }
        }
        return new { sessions, devices };
    }

    public static object SetVolume(JsonElement p, bool endpoint)
    {
        var id = Parameters.Text(p, "id", 8192);
        var volume = (float)Parameters.Number(p, "volume", 0, 1);
        var mute = Parameters.Boolean(p, "muted");
        using var enumerator = new MMDeviceEnumerator();
        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
        {
            using (device)
            {
                if (endpoint)
                {
                    if (device.ID != id) continue;
                    device.AudioEndpointVolume.MasterVolumeLevelScalar = volume;
                    if (mute.HasValue) device.AudioEndpointVolume.Mute = mute.Value;
                    return new { volume = device.AudioEndpointVolume.MasterVolumeLevelScalar, isMuted = device.AudioEndpointVolume.Mute };
                }
                var manager = device.AudioSessionManager;
                try
                {
                    var collection = manager.Sessions;
                    for (var i = 0; i < collection.Count; i++)
                    {
                        using var session = collection[i];
                        if (SessionId(device, session) != id) continue;
                        session.SimpleAudioVolume.Volume = volume;
                        if (mute.HasValue) session.SimpleAudioVolume.Mute = mute.Value;
                        return new { volume = session.SimpleAudioVolume.Volume, isMuted = session.SimpleAudioVolume.Mute };
                    }
                }
                finally { manager.Dispose(); }
            }
        }
        throw new NativeError("not_found", endpoint ? "The audio output is no longer available." : "The audio session has ended. Refresh the mixer.");
    }

    private static string SessionId(MMDevice device, AudioSessionControl session) => device.ID + "|" + session.GetSessionInstanceIdentifier;
}
