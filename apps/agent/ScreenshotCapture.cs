using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

namespace FocusTrace.Agent;

public sealed class ScreenshotCapture
{
    public byte[] CapturePrimaryScreenAsJpeg(long quality = 70L)
    {
        var bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds
            ?? throw new InvalidOperationException(
                "Primary screen could not be detected."
            );

        using var bitmap = new Bitmap(
            bounds.Width,
            bounds.Height,
            PixelFormat.Format24bppRgb
        );

        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.CopyFromScreen(
                bounds.Left,
                bounds.Top,
                0,
                0,
                bounds.Size
            );
        }

        using var stream = new MemoryStream();

        var jpegEncoder = ImageCodecInfo.GetImageEncoders()
            .First(codec => codec.FormatID == ImageFormat.Jpeg.Guid);

        using var encoderParameters = new EncoderParameters(1);

        encoderParameters.Param[0] = new EncoderParameter(
            System.Drawing.Imaging.Encoder.Quality,
            quality
        );

        bitmap.Save(
            stream,
            jpegEncoder,
            encoderParameters
        );

        return stream.ToArray();
    }
}