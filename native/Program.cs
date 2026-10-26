using System.Text;
using System.Text.Json;

namespace Sapphire.Native;

internal static class Program
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static async Task<int> Main(string[] args)
    {
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = new UTF8Encoding(false);
        if (args.Contains("--self-test")) return SelfTest.Run();
        if (args.Contains("--window-self-test")) return SelfTest.RunWindow();
        if (args.Contains("--audio-self-test")) return SelfTest.RunAudio();
        var parent = args.FirstOrDefault(a => a.StartsWith("--parent-pid=", StringComparison.Ordinal));
        var parentPid = parent != null && int.TryParse(parent[13..], out var pid) ? pid : 0;
        using var system = new SystemServices(parentPid, () => {
            try { Console.WriteLine("{\"event\":\"foreground-changed\"}"); }
            catch (IOException) { /* The host may have closed its pipe during shutdown. */ }
        });
        var media = new MediaServices();
        string? line;
        while ((line = await Console.In.ReadLineAsync()) != null)
        {
            long? id = null;
            try
            {
                using var request = ParseRequest(line);
                var root = request.RootElement;
                id = root.GetProperty("id").GetInt64();
                var method = root.GetProperty("method").GetString()!;
                var parameters = root.TryGetProperty("params", out var p) ? p : default;
                var result = await Dispatch(method, parameters, system, media);
                Console.WriteLine(JsonSerializer.Serialize(new { id, result }, Json));
            }
            catch (Exception ex)
            {
                var code = ex is NativeError error ? error.Code : ex is JsonException or ArgumentException or InvalidOperationException ? "invalid_request" : "operation_failed";
                Console.WriteLine(JsonSerializer.Serialize(new { id, error = new { code, message = ex.Message } }, Json));
            }
        }
        return 0;
    }

    internal static JsonDocument ParseRequest(string line)
    {
        if (line.Length > 65536) throw new NativeError("invalid_request", "Request exceeds 64 KiB.");
        var doc = JsonDocument.Parse(line, new JsonDocumentOptions { MaxDepth = 16 });
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.Number || !id.TryGetInt64(out var number) || number < 0 || !root.TryGetProperty("method", out var method) || method.ValueKind != JsonValueKind.String || method.GetString()!.Length is 0 or > 80 || (root.TryGetProperty("params", out var p) && p.ValueKind != JsonValueKind.Object))
        {
            doc.Dispose();
            throw new NativeError("invalid_request", "Expected {id: nonnegative integer, method: string, params?: object}.");
        }
        return doc;
    }

    private static async Task<object?> Dispatch(string method, JsonElement p, SystemServices system, MediaServices media) => method switch
    {
        "native.capabilities" => await system.Capabilities(media),
        "media.get" => await media.Get(),
        "media.control" => await media.Control(p),
        "audio.get" => AudioServices.Get(),
        "audio.volume" => AudioServices.SetVolume(p, false),
        "audio.deviceVolume" => AudioServices.SetVolume(p, true),
        "snap.apply" => system.Snap(p),
        "brightness.get" => SystemServices.GetBrightness(),
        "brightness.set" => SystemServices.SetBrightness(p),
        "battery.get" => SystemServices.GetBattery(),
        "bluetooth.list" => await SystemServices.Bluetooth(),
        "hello.availability" => await SystemServices.HelloAvailability(),
        "hello.verify" => await system.VerifyHello(p),
        "notifications.access" => await NotificationServices.RequestAccess(),
        "notifications.list" => await NotificationServices.List(),
        _ => throw new NativeError("unsupported_method", "Unsupported native method.")
    };
}

internal sealed class NativeError(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

internal static class Parameters
{
    public static string Text(JsonElement p, string name, int max = 4096)
    {
        if (p.ValueKind != JsonValueKind.Object || !p.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(v.GetString()) || v.GetString()!.Length > max)
            throw new NativeError("invalid_request", $"{name} must be a nonempty string of at most {max} characters.");
        return v.GetString()!;
    }

    public static double Number(JsonElement p, string name, double min, double max)
    {
        if (p.ValueKind != JsonValueKind.Object || !p.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.Number || !v.TryGetDouble(out var number) || !double.IsFinite(number) || number < min || number > max)
            throw new NativeError("invalid_request", $"{name} must be a number between {min} and {max}.");
        return number;
    }

    public static bool? Boolean(JsonElement p, string name)
    {
        if (!p.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) throw new NativeError("invalid_request", $"{name} must be a boolean.");
        return v.GetBoolean();
    }
}

internal static class SelfTest
{
    public static int Run()
    {
        var checks = 0;
        void Check(bool value, string name) { if (!value) throw new Exception("Self-test failed: " + name); checks++; }
        void Reject(Action action, string name) { try { action(); } catch (Exception ex) when (ex is NativeError or JsonException) { checks++; return; } throw new Exception("Self-test failed to reject " + name); }
        using var valid = Program.ParseRequest("{\"id\":1,\"method\":\"battery.get\",\"params\":{}}");
        Check(valid.RootElement.GetProperty("id").GetInt64() == 1, "request id");
        Check(System.Runtime.InteropServices.Marshal.SizeOf<HelloEnrollment.Identity>() == 76, "Windows biometric identity layout");
        Check(HelloEnrollment.HasFace(2) && HelloEnrollment.HasFace(10), "facial enrollment flag");
        Check(!HelloEnrollment.HasFace(0) && !HelloEnrollment.HasFace(8), "fingerprint is not facial enrollment");
        foreach (var invalid in new[] { "[]", "{}", "{\"id\":-1,\"method\":\"x\"}", "{\"id\":1,\"method\":\"x\",\"params\":[]}", "{\"id\":\"1\",\"method\":\"x\"}" }) Reject(() => Program.ParseRequest(invalid), "request shape");
        using var volume = JsonDocument.Parse("{\"volume\":1.2}");
        Reject(() => Parameters.Number(volume.RootElement, "volume", 0, 1), "volume bounds");
        using var wrongType = JsonDocument.Parse("{\"volume\":\"0.5\"}");
        Reject(() => Parameters.Number(wrongType.RootElement, "volume", 0, 1), "volume type");
        Reject(() => SystemServices.Layout("unknown", new NativeMethods.Rect { Left = 0, Top = 0, Right = 100, Bottom = 100 }), "layout allowlist");
        var left = SystemServices.Layout("left", new NativeMethods.Rect { Left = -1920, Top = 40, Right = 0, Bottom = 1080 });
        Check(left == (-1920, 40, 960, 1040), "negative monitor origin and taskbar work area");
        var right = SystemServices.Layout("bottom-right", new NativeMethods.Rect { Left = 100, Top = 20, Right = 1101, Bottom = 721 });
        Check(right == (600, 370, 501, 351), "odd pixel remainder");
        using var missing = JsonDocument.Parse("{}");
        Reject(() => Parameters.Text(missing.RootElement, "id"), "missing id");
        Console.WriteLine(JsonSerializer.Serialize(new { ok = true, checks, runtimePath = typeof(object).Assembly.Location }));
        return 0;
    }

    public static int RunWindow()
    {
        var before = NativeMethods.GetForegroundWindow();
        var fixture = NativeMethods.CreateWindowEx(0, "STATIC", "Sapphire owned native test", 0x00CF0000, 100, 100, 500, 300, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
        if (fixture == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(System.Runtime.InteropServices.Marshal.GetLastWin32Error());
        var checks = 0;
        try
        {
            foreach (var layout in new[] { "left", "right", "top-left", "top-right", "bottom-left", "bottom-right", "center", "maximize" })
            {
                SystemServices.PositionWindow(fixture, layout);
                if (!NativeMethods.GetWindowRect(fixture, out var rect) || rect.Right <= rect.Left || rect.Bottom <= rect.Top) throw new Exception("Invalid test-window bounds.");
                if (NativeMethods.IsWindowVisible(fixture)) throw new Exception("The hidden fixture became visible.");
                checks++;
            }
            if (NativeMethods.GetForegroundWindow() != before) throw new Exception("Positioning stole foreground focus.");
            checks++;
            Console.WriteLine(JsonSerializer.Serialize(new { ok = true, checks, fixture = "owned hidden window", focusPreserved = true }));
            return 0;
        }
        finally { NativeMethods.DestroyWindow(fixture); }
    }

    public static int RunAudio()
    {
        // Only this process's silent test session is changed. Device/master volume is untouched.
        using var enumerator = new NAudio.CoreAudioApi.MMDeviceEnumerator();
        using var device = enumerator.GetDefaultAudioEndpoint(NAudio.CoreAudioApi.DataFlow.Render, NAudio.CoreAudioApi.Role.Multimedia);
        using var output = new NAudio.Wave.WasapiOut(device, NAudio.CoreAudioApi.AudioClientShareMode.Shared, false, 100);
        output.Init(new Silence());
        output.Play();
        var manager = device.AudioSessionManager;
        try
        {
            var sessions = manager.Sessions;
            for (var index = 0; index < sessions.Count; index++)
            {
                using var session = sessions[index];
                if (session.GetProcessID != Environment.ProcessId) continue;
                var originalVolume = session.SimpleAudioVolume.Volume;
                var originalMute = session.SimpleAudioVolume.Mute;
                try
                {
                    using var parameters = JsonDocument.Parse(JsonSerializer.Serialize(new { id = device.ID + "|" + session.GetSessionInstanceIdentifier, volume = 0.25, muted = true }));
                    _ = AudioServices.SetVolume(parameters.RootElement, false);
                    if (Math.Abs(session.SimpleAudioVolume.Volume - 0.25) > 0.001 || !session.SimpleAudioVolume.Mute) throw new Exception("The silent fixture volume/mute readback failed.");
                    Console.WriteLine(JsonSerializer.Serialize(new { ok = true, checks = 2, fixture = "owned silent WASAPI session", masterVolumeChanged = false }));
                    return 0;
                }
                finally { session.SimpleAudioVolume.Volume = originalVolume; session.SimpleAudioVolume.Mute = originalMute; }
            }
            throw new Exception("The owned audio fixture did not register a Windows audio session.");
        }
        finally { manager.Dispose(); output.Stop(); }
    }

    private sealed class Silence : NAudio.Wave.IWaveProvider
    {
        public NAudio.Wave.WaveFormat WaveFormat { get; } = new(48000, 16, 2);
        public int Read(byte[] buffer, int offset, int count) { Array.Clear(buffer, offset, count); return count; }
    }
}
