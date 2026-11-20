using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LiquidGlass;

/// <summary>
/// The Liquid Glass squircle outline (SPEC 1.2 / anywhere.md 2.4: cubic beziers, k = 0.66) as a frozen
/// <see cref="StreamGeometry"/>. WPF has only circular-arc corners (<c>CornerRadius</c>), so every squircle
/// is drawn or clipped through this geometry.
/// </summary>
public static class SquircleGeometry
{
    /// <summary>tokens.json radius.squircleBezierC. Control-point pull: c = r * (1 - K).</summary>
    public const double K = 0.66;

    public static StreamGeometry Create(Rect rect, double radius, double k = K)
    {
        double r = Math.Max(0, Math.Min(radius, Math.Min(rect.Width, rect.Height) / 2));
        double l = rect.Left, t = rect.Top, rt = rect.Right, b = rect.Bottom;
        var g = new StreamGeometry();
        using (StreamGeometryContext c = g.Open())
        {
            if (r < 0.01)
            {
                c.BeginFigure(new Point(l, t), true, true);
                c.LineTo(new Point(rt, t), true, false);
                c.LineTo(new Point(rt, b), true, false);
                c.LineTo(new Point(l, b), true, false);
            }
            else
            {
                double cc = r * (1 - k);
                c.BeginFigure(new Point(l, t + r), true, true);
                c.BezierTo(new Point(l, t + cc), new Point(l + cc, t), new Point(l + r, t), true, false);
                c.LineTo(new Point(rt - r, t), true, false);
                c.BezierTo(new Point(rt - cc, t), new Point(rt, t + cc), new Point(rt, t + r), true, false);
                c.LineTo(new Point(rt, b - r), true, false);
                c.BezierTo(new Point(rt, b - cc), new Point(rt - cc, b), new Point(rt - r, b), true, false);
                c.LineTo(new Point(l + r, b), true, false);
                c.BezierTo(new Point(l + cc, b), new Point(l, b - cc), new Point(l, b - r), true, false);
            }
        }
        g.Freeze();
        return g;
    }
}

/// <summary>
/// A <c>Border</c> with a squircle outline. Paints <see cref="Background"/> and a gradient-capable
/// <see cref="BorderBrush"/> stroke, and clips its child to the squircle, so layered gel / frost layers inside
/// it follow the continuous corner. <see cref="Radius"/> is absolute device-independent pixels (the spec uses one
/// absolute radius per grid module, not a ratio of each card).
/// Put a <c>DropShadowEffect</c> on a separate sibling, not on this element: an Effect re-rasterises the whole
/// subtree (text loses ClearType) and the child clip would cut the shadow.
/// </summary>
public class SquircleBorder : Decorator
{
    public static readonly DependencyProperty BackgroundProperty = DependencyProperty.Register(
        nameof(Background), typeof(Brush), typeof(SquircleBorder),
        new FrameworkPropertyMetadata(null, FrameworkPropertyMetadataOptions.AffectsRender));

    public static readonly DependencyProperty BorderBrushProperty = DependencyProperty.Register(
        nameof(BorderBrush), typeof(Brush), typeof(SquircleBorder),
        new FrameworkPropertyMetadata(null, FrameworkPropertyMetadataOptions.AffectsRender));

    public static readonly DependencyProperty BorderThicknessProperty = DependencyProperty.Register(
        nameof(BorderThickness), typeof(double), typeof(SquircleBorder),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));

    public static readonly DependencyProperty RadiusProperty = DependencyProperty.Register(
        nameof(Radius), typeof(double), typeof(SquircleBorder),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsArrange | FrameworkPropertyMetadataOptions.AffectsRender));

    public static readonly DependencyProperty PaddingProperty = DependencyProperty.Register(
        nameof(Padding), typeof(Thickness), typeof(SquircleBorder),
        new FrameworkPropertyMetadata(new Thickness(0), FrameworkPropertyMetadataOptions.AffectsMeasure));

    public Brush? Background { get => (Brush?)GetValue(BackgroundProperty); set => SetValue(BackgroundProperty, value); }
    public Brush? BorderBrush { get => (Brush?)GetValue(BorderBrushProperty); set => SetValue(BorderBrushProperty, value); }
    public double BorderThickness { get => (double)GetValue(BorderThicknessProperty); set => SetValue(BorderThicknessProperty, value); }
    public double Radius { get => (double)GetValue(RadiusProperty); set => SetValue(RadiusProperty, value); }
    public Thickness Padding { get => (Thickness)GetValue(PaddingProperty); set => SetValue(PaddingProperty, value); }

    private Size Chrome => new(
        2 * BorderThickness + Padding.Left + Padding.Right,
        2 * BorderThickness + Padding.Top + Padding.Bottom);

    protected override Size MeasureOverride(Size constraint)
    {
        Size chrome = Chrome;
        if (Child is null) return chrome;
        Child.Measure(new Size(Math.Max(0, constraint.Width - chrome.Width), Math.Max(0, constraint.Height - chrome.Height)));
        return new Size(Child.DesiredSize.Width + chrome.Width, Child.DesiredSize.Height + chrome.Height);
    }

    protected override Size ArrangeOverride(Size arrangeSize)
    {
        if (Child is not null)
        {
            double bt = BorderThickness;
            var slot = new Rect(bt + Padding.Left, bt + Padding.Top,
                Math.Max(0, arrangeSize.Width - 2 * bt - Padding.Left - Padding.Right),
                Math.Max(0, arrangeSize.Height - 2 * bt - Padding.Top - Padding.Bottom));
            Child.Arrange(slot);
            // The clip lives in the child's own coordinates: the control's inner squircle, shifted back by the slot origin.
            Child.Clip = SquircleGeometry.Create(
                new Rect(bt - slot.X, bt - slot.Y, Math.Max(0, arrangeSize.Width - 2 * bt), Math.Max(0, arrangeSize.Height - 2 * bt)),
                Radius - bt);
        }
        return arrangeSize;
    }

    protected override void OnRender(DrawingContext drawingContext)
    {
        var outer = new Rect(0, 0, ActualWidth, ActualHeight);
        if (outer.Width <= 0 || outer.Height <= 0) return;
        double bt = BorderThickness;
        if (Background is not null)
            drawingContext.DrawGeometry(Background, null, SquircleGeometry.Create(outer, Radius));
        if (bt > 0 && BorderBrush is not null)
        {
            var inset = new Rect(bt / 2, bt / 2, Math.Max(0, outer.Width - bt), Math.Max(0, outer.Height - bt));
            drawingContext.DrawGeometry(null, new Pen(BorderBrush, bt), SquircleGeometry.Create(inset, Radius - bt / 2));
        }
    }
}
