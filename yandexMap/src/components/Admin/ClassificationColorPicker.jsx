import React, { memo } from "react";
import { markerPresetLabel } from "../../utils/markerColors.js";
import {
  presetHex,
  presetOptionsWithHex,
  validateColorChoice,
} from "../../utils/classificationColorUtils.js";

function ClassificationColorPicker({
  value,
  onChange,
  others,
  currentKey,
  disabled,
}) {
  const options = presetOptionsWithHex();
  const warnings = validateColorChoice(
    value,
    others.filter((o) => o.key !== currentKey)
  );

  return (
    <div className="tax-color-picker">
      <div className="tax-color-picker__preview-row">
        <span
          className="tax-marker-preview"
          style={{ background: presetHex(value) }}
          title="Как на карте"
          aria-hidden
        />
        <div>
          <span className="tax-color-picker__label">
            {markerPresetLabel(value)}
          </span>
          <span className="tax-color-picker__hex">{presetHex(value)}</span>
        </div>
      </div>
      <div className="tax-color-picker__grid" role="listbox" aria-label="Цвет метки">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={value === o.value}
            className={`tax-color-swatch${value === o.value ? " tax-color-swatch--on" : ""}`}
            style={{ "--swatch": o.hex }}
            title={`${o.label} (${o.hex})`}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          />
        ))}
      </div>
      {warnings.length > 0 ? (
        <ul className="tax-color-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default memo(ClassificationColorPicker);
