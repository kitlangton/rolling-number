# Rolling Number

Rolling Number animates changes between formatted numeric values. It is a display
primitive, not an input, ticker scheduler, chart, or numeric tween that reformats
the number on every frame.

- **Value**: the caller's `number` or `bigint`, never a parsed display string.
- **Formatted value**: the full string and semantic parts produced by `Intl.NumberFormat`.
- **Digit place**: a stable integer or fraction position, independent of grouping separators.
- **Glyph**: a visible digit, symbol, or literal. The accessible value is separate from animated glyphs.
- **Transition**: movement from the currently displayed state to the newest target; a newer target interrupts rather than queues behind it.
- **Measurement**: actual browser geometry. Font and size changes invalidate geometry without changing the numeric value.

The project aims for smooth interruption, predictable typography, bounded work,
and transparent comparisons. Faster than another library is a measured result
for a particular workload, not a design assumption.
