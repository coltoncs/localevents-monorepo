import { useId, useState } from "react";
import { CUISINES, isKnownCuisine } from "#/lib/cuisines";
import type { Cuisine } from "#/lib/types";

const CUSTOM_SENTINEL = "__custom__";

export function CuisineSelect({
	label,
	value,
	onChange,
	className,
	labelClassName,
	required,
}: {
	label: string;
	value: Cuisine;
	onChange: (v: Cuisine) => void;
	className: string;
	labelClassName: string;
	required?: boolean;
}) {
	const startsCustom = value !== "" && !isKnownCuisine(value);
	const [custom, setCustom] = useState(startsCustom);
	const selectId = useId();
	const inputId = useId();

	const selectValue = custom ? CUSTOM_SENTINEL : value;

	function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
		const v = e.target.value;
		if (v === CUSTOM_SENTINEL) {
			setCustom(true);
			onChange("");
		} else {
			setCustom(false);
			onChange(v);
		}
	}

	return (
		<div>
			<label htmlFor={selectId} className={labelClassName}>
				{label}
			</label>
			<select
				id={selectId}
				value={selectValue}
				onChange={handleSelect}
				required={required}
				className={className}
			>
				{CUISINES.map((c) => (
					<option key={c.value} value={c.value}>
						{c.label}
					</option>
				))}
				<option value={CUSTOM_SENTINEL}>Add your own…</option>
			</select>
			{custom && (
				<input
					id={inputId}
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Enter cuisine"
					maxLength={50}
					required={required}
					aria-label="Custom cuisine"
					className={`${className} mt-2`}
				/>
			)}
		</div>
	);
}
