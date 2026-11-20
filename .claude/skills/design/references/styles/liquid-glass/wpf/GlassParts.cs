using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;

namespace LiquidGlass;

/// <summary>Attached properties the gel and frost templates read, so one template serves every colourway and ground.</summary>
public static class Glass
{
    /// <summary>Gel bloom (the bottom-weighted radial). The tile's Background is the linear base.</summary>
    public static readonly DependencyProperty BloomProperty = DependencyProperty.RegisterAttached("Bloom", typeof(Brush), typeof(Glass));
    /// <summary>Gel pale edge wash.</summary>
    public static readonly DependencyProperty WashProperty = DependencyProperty.RegisterAttached("Wash", typeof(Brush), typeof(Glass));
    /// <summary>Frost plate: the sibling element that paints the ground behind the plate (never an ancestor of the plate).</summary>
    public static readonly DependencyProperty GroundProperty = DependencyProperty.RegisterAttached("Ground", typeof(UIElement), typeof(Glass));
    /// <summary>Frost plate: tint laid over the blurred copy (decorative 0.22 white, or the text-bearing ground tint).</summary>
    public static readonly DependencyProperty TintProperty = DependencyProperty.RegisterAttached("Tint", typeof(Brush), typeof(Glass));
    /// <summary>Surface radius in pixels (SquircleBorder.Radius). Card 32, gel 43 from the 144 px module; a stadium plate = half its height.</summary>
    public static readonly DependencyProperty RadiusProperty = DependencyProperty.RegisterAttached("Radius", typeof(double), typeof(Glass), new PropertyMetadata(32.0));

    public static Brush? GetBloom(DependencyObject o) => (Brush?)o.GetValue(BloomProperty);
    public static void SetBloom(DependencyObject o, Brush? v) => o.SetValue(BloomProperty, v);
    public static Brush? GetWash(DependencyObject o) => (Brush?)o.GetValue(WashProperty);
    public static void SetWash(DependencyObject o, Brush? v) => o.SetValue(WashProperty, v);
    public static UIElement? GetGround(DependencyObject o) => (UIElement?)o.GetValue(GroundProperty);
    public static void SetGround(DependencyObject o, UIElement? v) => o.SetValue(GroundProperty, v);
    public static Brush? GetTint(DependencyObject o) => (Brush?)o.GetValue(TintProperty);
    public static void SetTint(DependencyObject o, Brush? v) => o.SetValue(TintProperty, v);
    public static double GetRadius(DependencyObject o) => (double)o.GetValue(RadiusProperty);
    public static void SetRadius(DependencyObject o, double v) => o.SetValue(RadiusProperty, v);
}

/// <summary>
/// Grain: a 128 px noise tile generated in code (no asset file), tiled with normal alpha blending.
/// WPF has no overlay blend mode, so the noise is alpha-baked (random grey at low alpha) and reads flatter
/// than a CSS mix-blend-mode overlay grain. Opacity on the element scales it.
/// </summary>
public sealed class GrainOverlay : FrameworkElement
{
    private const int Tile = 128;
    private static readonly ImageBrush TileBrush = BuildBrush();

    public GrainOverlay() { IsHitTestVisible = false; }

    private static ImageBrush BuildBrush()
    {
        var bmp = new WriteableBitmap(Tile, Tile, 96, 96, PixelFormats.Pbgra32, null);
        var px = new byte[Tile * Tile * 4];
        var rnd = new Random(0x4C47);                         // fixed seed: the same grain every run
        for (int i = 0; i < Tile * Tile; i++)
        {
            byte v = (byte)rnd.Next(256);
            byte a = 22;                                      // alpha about 0.086, premultiplied below
            px[i * 4 + 0] = (byte)(v * a / 255);
            px[i * 4 + 1] = (byte)(v * a / 255);
            px[i * 4 + 2] = (byte)(v * a / 255);
            px[i * 4 + 3] = a;
        }
        bmp.WritePixels(new Int32Rect(0, 0, Tile, Tile), px, Tile * 4, 0);
        bmp.Freeze();
        var b = new ImageBrush(bmp)
        {
            TileMode = TileMode.Tile,
            ViewportUnits = BrushMappingMode.Absolute,
            Viewport = new Rect(0, 0, Tile, Tile),
            Stretch = Stretch.None,
        };
        RenderOptions.SetBitmapScalingMode(b, BitmapScalingMode.NearestNeighbor);
        b.Freeze();
        return b;
    }

    protected override void OnRender(DrawingContext drawingContext) => drawingContext.DrawRectangle(TileBrush, null, new Rect(RenderSize));
}

/// <summary>
/// Dot-matrix numerals (SPEC 5.2) from a 5x7 glyph table, drawn as ellipses: dot diameter = 0.6 of the pitch.
/// Primary values only, never the only form of a decision-critical number: show the same value as sans text
/// in the same card. A bare FrameworkElement has no automation peer, so UI Automation never exposes the dots (the real value is the text).
/// </summary>
public sealed class DotMatrix : FrameworkElement
{
    private static readonly Dictionary<char, string[]> Glyphs = new()
    {
        ['0'] = new[] { "01110", "10001", "10011", "10101", "11001", "10001", "01110" },
        ['1'] = new[] { "00100", "01100", "00100", "00100", "00100", "00100", "01110" },
        ['2'] = new[] { "01110", "10001", "00001", "00010", "00100", "01000", "11111" },
        ['3'] = new[] { "11111", "00010", "00100", "00010", "00001", "10001", "01110" },
        ['4'] = new[] { "00010", "00110", "01010", "10010", "11111", "00010", "00010" },
        ['5'] = new[] { "11111", "10000", "11110", "00001", "00001", "10001", "01110" },
        ['6'] = new[] { "00110", "01000", "10000", "11110", "10001", "10001", "01110" },
        ['7'] = new[] { "11111", "00001", "00010", "00100", "01000", "01000", "01000" },
        ['8'] = new[] { "01110", "10001", "10001", "01110", "10001", "10001", "01110" },
        ['9'] = new[] { "01110", "10001", "10001", "01111", "00001", "00010", "01100" },
        ['.'] = new[] { "00000", "00000", "00000", "00000", "00000", "01100", "01100" },
        [':'] = new[] { "00000", "01100", "01100", "00000", "01100", "01100", "00000" },
        ['-'] = new[] { "00000", "00000", "00000", "11111", "00000", "00000", "00000" },
        ['/'] = new[] { "00001", "00010", "00010", "00100", "01000", "01000", "10000" },
    };

    public static readonly DependencyProperty TextProperty = DependencyProperty.Register(nameof(Text), typeof(string), typeof(DotMatrix),
        new FrameworkPropertyMetadata("", FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));
    public static readonly DependencyProperty PitchProperty = DependencyProperty.Register(nameof(Pitch), typeof(double), typeof(DotMatrix),
        new FrameworkPropertyMetadata(8.0, FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));
    public static readonly DependencyProperty ForegroundProperty = TextElement.ForegroundProperty.AddOwner(typeof(DotMatrix),
        new FrameworkPropertyMetadata(Brushes.Black, FrameworkPropertyMetadataOptions.AffectsRender | FrameworkPropertyMetadataOptions.Inherits));

    // No automation peer is created for a bare FrameworkElement, so UI Automation never sees the dots: expose the value as text beside it.
    public DotMatrix() { IsHitTestVisible = false; }

    public string Text { get => (string)GetValue(TextProperty); set => SetValue(TextProperty, value); }
    /// <summary>Distance between dot centres. Glyph height = 7 pitches (SPEC: pitch about 1/7 of glyph height); keep the glyph at 24 px or more (pitch 3.4).</summary>
    public double Pitch { get => (double)GetValue(PitchProperty); set => SetValue(PitchProperty, value); }
    public Brush Foreground { get => (Brush)GetValue(ForegroundProperty); set => SetValue(ForegroundProperty, value); }

    /// <summary>Columns used by the text: each glyph plus one blank column (the trailing one is not part of the width).</summary>
    private int Columns()
    {
        int cols = 0;
        foreach (char ch in Text ?? "")
            if (Glyphs.TryGetValue(ch, out var rows)) cols += rows[0].Length + 1;
        return cols;
    }

    protected override Size MeasureOverride(Size availableSize)
    {
        int cols = Columns();
        return new Size(cols == 0 ? 0 : (cols - 1) * Pitch, 7 * Pitch);
    }

    protected override void OnRender(DrawingContext drawingContext)
    {
        double d = Pitch * 0.6 / 2;                           // tokens type.dot.diameterOfPitch = 0.6
        int col = 0;
        foreach (char ch in Text ?? "")
        {
            if (!Glyphs.TryGetValue(ch, out var rows)) continue;
            for (int y = 0; y < 7; y++)
                for (int x = 0; x < rows[y].Length; x++)
                    if (rows[y][x] == '1')
                        drawingContext.DrawEllipse(Foreground, null, new Point((col + x + 0.5) * Pitch, (y + 0.5) * Pitch), d, d);
            col += rows[0].Length + 1;
        }
    }
}

/// <summary>
/// Faux per-element backdrop blur. WPF cannot blur what is behind an element, but it can paint a live copy of a
/// sibling element (the ground) cropped to this element's bounds, and BlurEffect that copy.
/// Put it inside a clipped plate with a negative margin (bleed of about 2x the blur radius) so the blurred edge stays solid.
/// Limits: the copy shows only Source, not other plates stacked beneath; the ground must not contain the plate.
/// </summary>
public sealed class FrostBackdrop : FrameworkElement
{
    public static readonly DependencyProperty SourceProperty = DependencyProperty.Register(nameof(Source), typeof(UIElement), typeof(FrostBackdrop),
        new FrameworkPropertyMetadata(null, FrameworkPropertyMetadataOptions.AffectsRender));

    private Rect _last = Rect.Empty;

    public FrostBackdrop()
    {
        IsHitTestVisible = false;
        LayoutUpdated += (_, _) =>
        {
            Rect r = Region();
            if (r != _last) { _last = r; InvalidateVisual(); }
        };
    }

    public UIElement? Source { get => (UIElement?)GetValue(SourceProperty); set => SetValue(SourceProperty, value); }

    private Rect Region()
    {
        UIElement? s = Source;
        if (s is null || !IsVisible || !s.IsVisible || ActualWidth <= 0 || ActualHeight <= 0) return Rect.Empty;
        try { return TransformToVisual(s).TransformBounds(new Rect(0, 0, ActualWidth, ActualHeight)); }
        catch (InvalidOperationException) { return Rect.Empty; }   // not in the same visual tree yet
    }

    protected override void OnRender(DrawingContext drawingContext)
    {
        Rect region = Region();
        if (region.IsEmpty || Source is null) return;
        var brush = new VisualBrush(Source)
        {
            ViewboxUnits = BrushMappingMode.Absolute,
            Viewbox = region,
            ViewportUnits = BrushMappingMode.Absolute,
            Viewport = new Rect(0, 0, ActualWidth, ActualHeight),
            Stretch = Stretch.Fill,
        };
        drawingContext.DrawRectangle(brush, null, new Rect(RenderSize));
    }
}

/// <summary>
/// Closed-form damped spring as an easing function (anywhere.md 2.5). Use with EasingMode EaseIn (the default),
/// Duration = SettleMs. Overshoot (the value exceeds 1) is real; DoubleAnimation does not clamp it.
/// </summary>
public sealed class SpringEase : EasingFunctionBase
{
    // EasingFunctionBase defaults to EaseOut, which would play the spring backwards (measured: Ease(.25) = -0.015). Force EaseIn.
    public SpringEase() { EasingMode = EasingMode.EaseIn; }

    public double Tension { get; set; } = 220;
    public double Friction { get; set; } = 21;
    public double SettleMs { get; set; } = 563;

    protected override double EaseInCore(double normalizedTime)
    {
        double w0 = Math.Sqrt(Tension), z = Friction / (2 * w0), t = normalizedTime * SettleMs / 1000.0;
        if (z >= 1) return 1 - (1 + w0 * t) * Math.Exp(-w0 * t);
        double wd = w0 * Math.Sqrt(1 - z * z);
        return 1 - Math.Exp(-z * w0 * t) * (Math.Cos(wd * t) + z * w0 / wd * Math.Sin(wd * t));
    }

    protected override Freezable CreateInstanceCore() => new SpringEase { Tension = Tension, Friction = Friction, SettleMs = SettleMs, EasingMode = EasingMode };
}
