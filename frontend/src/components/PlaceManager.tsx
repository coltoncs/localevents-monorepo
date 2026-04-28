import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { emptyPlaceForm, PlaceForm, placeToForm } from "#/components/PlaceForm";
import { Spinner } from "#/components/Spinner";
import { formatCuisineLabel } from "#/lib/cuisines";
import {
	useCreatePlace,
	useDeletePlace,
	usePlaces,
	useUpdatePlace,
} from "#/lib/hooks/usePlaces";
import type { CreatePlaceInput, Place } from "#/lib/types";

const WIDE_CENTER = { lat: 35.7796, lng: -78.6382 };
const WIDE_RADIUS = 500;

type KindFilter = "all" | "food_only" | "drink_only" | "both";

function ActionsCell({
	place,
	onEdit,
}: {
	place: Place;
	onEdit: (p: Place) => void;
}) {
	const deletePlace = useDeletePlace();
	const [confirming, setConfirming] = useState(false);

	return (
		<div className="flex justify-end gap-2">
			<button
				type="button"
				onClick={() => onEdit(place)}
				className="cursor-pointer rounded-md border border-(--line) px-2.5 py-1 text-xs font-medium text-(--sea-ink) hover:bg-(--surface)"
			>
				Edit
			</button>
			{confirming ? (
				<button
					type="button"
					onClick={() => deletePlace.mutate(place.ID)}
					disabled={deletePlace.isPending}
					className="cursor-pointer rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
				>
					{deletePlace.isPending ? "..." : "Confirm"}
				</button>
			) : (
				<button
					type="button"
					onClick={() => setConfirming(true)}
					className="cursor-pointer rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
				>
					Delete
				</button>
			)}
		</div>
	);
}

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
	if (!isSorted) {
		return (
			<svg
				className="ml-1 inline h-3 w-3 opacity-30"
				viewBox="0 0 16 16"
				fill="currentColor"
				aria-hidden="true"
			>
				<path d="M8 3l4 5H4zM8 13l-4-5h8z" />
			</svg>
		);
	}
	return (
		<svg
			className="ml-1 inline h-3 w-3"
			viewBox="0 0 16 16"
			fill="currentColor"
			aria-hidden="true"
		>
			{isSorted === "asc" ? (
				<path d="M8 3l4 5H4z" />
			) : (
				<path d="M8 13l-4-5h8z" />
			)}
		</svg>
	);
}

function KindBadges({ place }: { place: Place }) {
	return (
		<div className="flex flex-wrap gap-1">
			{place.IsFood && place.Cuisine && (
				<span className="rounded-full bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-900 dark:bg-orange-900/30 dark:text-orange-300">
					{formatCuisineLabel(place.Cuisine)}
				</span>
			)}
			{place.IsDrink && place.BarType && (
				<span
					className={`rounded-full px-2 py-0.5 text-xs font-medium ${
						place.BarType === "brewery"
							? "bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
							: "bg-purple-200 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300"
					}`}
				>
					{place.BarType === "brewery" ? "Brewery" : "Bar"}
				</span>
			)}
		</div>
	);
}

export function PlaceManager() {
	const { data, isLoading } = usePlaces({
		lat: WIDE_CENTER.lat,
		lng: WIDE_CENTER.lng,
		radius: WIDE_RADIUS,
	});
	const places = data?.places ?? [];

	const createPlace = useCreatePlace();
	const updatePlace = useUpdatePlace();

	const [mode, setMode] = useState<"list" | "create" | { editing: Place }>(
		"list",
	);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [kindFilter, setKindFilter] = useState<KindFilter>("all");

	const filteredData = useMemo(() => {
		switch (kindFilter) {
			case "food_only":
				return places.filter((p) => p.IsFood && !p.IsDrink);
			case "drink_only":
				return places.filter((p) => p.IsDrink && !p.IsFood);
			case "both":
				return places.filter((p) => p.IsFood && p.IsDrink);
			default:
				return places;
		}
	}, [places, kindFilter]);

	const columns = useMemo<ColumnDef<Place>[]>(
		() => [
			{
				accessorKey: "Name",
				header: "Name",
				cell: ({ row }) => (
					<Link
						to="/place/$placeId"
						params={{ placeId: row.original.ID }}
						className="font-medium text-(--lagoon-deep) hover:text-(--lagoon)"
					>
						{row.original.Name}
					</Link>
				),
			},
			{
				id: "kind",
				header: "Kind",
				cell: ({ row }) => <KindBadges place={row.original} />,
			},
			{
				id: "location",
				accessorFn: (row) => [row.City, row.State].filter(Boolean).join(", "),
				header: "Location",
				meta: { hideOnMobile: true },
			},
			{
				id: "actions",
				header: () => <span className="sr-only">Actions</span>,
				enableSorting: false,
				cell: ({ row }) => (
					<ActionsCell
						place={row.original}
						onEdit={(p) => setMode({ editing: p })}
					/>
				),
			},
		],
		[],
	);

	const table = useReactTable({
		data: filteredData,
		columns,
		state: { sorting, globalFilter },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize: 20 } },
	});

	function handleCreate(formData: CreatePlaceInput) {
		createPlace.mutate(formData, {
			onSuccess: () => setMode("list"),
		});
	}

	function handleUpdate(formData: CreatePlaceInput) {
		if (typeof mode !== "object") return;
		updatePlace.mutate(
			{ id: mode.editing.ID, data: formData },
			{ onSuccess: () => setMode("list") },
		);
	}

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-xl font-bold text-(--sea-ink)">
					Manage Places
					{places.length > 0 && (
						<span className="ml-2 inline-flex items-center rounded-full bg-[rgba(79,184,178,0.14)] px-2.5 py-0.5 text-sm font-medium text-(--lagoon-deep)">
							{places.length}
						</span>
					)}
				</h2>
				{mode === "list" && (
					<button
						type="button"
						onClick={() => setMode("create")}
						className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon)"
					>
						Add Place
					</button>
				)}
			</div>

			{mode === "create" && (
				<PlaceForm
					initial={emptyPlaceForm()}
					onSubmit={handleCreate}
					onCancel={() => setMode("list")}
					isPending={createPlace.isPending}
					isError={createPlace.isError}
					submitLabel="Create"
				/>
			)}

			{typeof mode === "object" && (
				<PlaceForm
					initial={placeToForm(mode.editing)}
					onSubmit={handleUpdate}
					onCancel={() => setMode("list")}
					isPending={updatePlace.isPending}
					isError={updatePlace.isError}
					submitLabel="Save Changes"
				/>
			)}

			{mode === "list" &&
				(isLoading ? (
					<Spinner className="py-12" />
				) : places.length === 0 ? (
					<p className="py-8 text-center text-(--sea-ink-soft)">
						No places yet. Click "Add Place" to create one.
					</p>
				) : (
					<div className="space-y-3">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
							<input
								type="text"
								value={globalFilter}
								onChange={(e) => setGlobalFilter(e.target.value)}
								placeholder="Search by name or location..."
								className="rounded-md border border-(--line) bg-(--surface) px-3 py-1.5 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon) sm:w-64"
							/>
							<select
								value={kindFilter}
								onChange={(e) => setKindFilter(e.target.value as KindFilter)}
								className="rounded-md border border-(--line) bg-(--surface) px-3 py-1.5 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
							>
								<option value="all">All kinds</option>
								<option value="food_only">Food only</option>
								<option value="drink_only">Drinks only</option>
								<option value="both">Both</option>
							</select>
							<span className="text-xs text-(--sea-ink-soft)">
								{table.getFilteredRowModel().rows.length} of {places.length}
							</span>
						</div>

						<div className="overflow-hidden rounded-lg border border-(--line) bg-(--surface-strong)">
							<table className="w-full text-sm">
								<thead>
									{table.getHeaderGroups().map((headerGroup) => (
										<tr
											key={headerGroup.id}
											className="border-b border-(--line) text-left text-(--sea-ink-soft)"
										>
											{headerGroup.headers.map((header) => {
												const hideOnMobile = (
													header.column.columnDef.meta as {
														hideOnMobile?: boolean;
													}
												)?.hideOnMobile;
												return (
													<th
														key={header.id}
														className={`px-4 py-2 font-medium ${
															header.id === "actions" ? "text-right" : ""
														} ${hideOnMobile ? "hidden sm:table-cell" : ""}`}
													>
														{header.isPlaceholder ? null : header.column.getCanSort() ? (
															<button
																type="button"
																onClick={header.column.getToggleSortingHandler()}
																className="cursor-pointer select-none"
															>
																{flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}
																<SortIcon
																	isSorted={header.column.getIsSorted()}
																/>
															</button>
														) : (
															flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)
														)}
													</th>
												);
											})}
										</tr>
									))}
								</thead>
								<tbody>
									{table.getRowModel().rows.map((row) => (
										<tr
											key={row.id}
											className="border-b border-(--line) last:border-0"
										>
											{row.getVisibleCells().map((cell) => {
												const hideOnMobile = (
													cell.column.columnDef.meta as {
														hideOnMobile?: boolean;
													}
												)?.hideOnMobile;
												return (
													<td
														key={cell.id}
														className={`px-4 py-2 ${
															cell.column.id === "actions" ? "text-right" : ""
														} ${hideOnMobile ? "hidden sm:table-cell" : ""} ${
															cell.column.id === "location"
																? "text-sm text-(--sea-ink-soft)"
																: ""
														}`}
													>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{table.getPageCount() > 1 && (
							<div className="flex items-center justify-between text-sm">
								<span className="text-(--sea-ink-soft)">
									Page {table.getState().pagination.pageIndex + 1} of{" "}
									{table.getPageCount()}
								</span>
								<div className="flex gap-1">
									<button
										type="button"
										onClick={() => table.firstPage()}
										disabled={!table.getCanPreviousPage()}
										className="cursor-pointer rounded-md border border-(--line) px-2.5 py-1 text-xs font-medium text-(--sea-ink) hover:bg-(--surface) disabled:opacity-40"
									>
										First
									</button>
									<button
										type="button"
										onClick={() => table.previousPage()}
										disabled={!table.getCanPreviousPage()}
										className="cursor-pointer rounded-md border border-(--line) px-2.5 py-1 text-xs font-medium text-(--sea-ink) hover:bg-(--surface) disabled:opacity-40"
									>
										Prev
									</button>
									<button
										type="button"
										onClick={() => table.nextPage()}
										disabled={!table.getCanNextPage()}
										className="cursor-pointer rounded-md border border-(--line) px-2.5 py-1 text-xs font-medium text-(--sea-ink) hover:bg-(--surface) disabled:opacity-40"
									>
										Next
									</button>
									<button
										type="button"
										onClick={() => table.lastPage()}
										disabled={!table.getCanNextPage()}
										className="cursor-pointer rounded-md border border-(--line) px-2.5 py-1 text-xs font-medium text-(--sea-ink) hover:bg-(--surface) disabled:opacity-40"
									>
										Last
									</button>
								</div>
							</div>
						)}
					</div>
				))}
		</div>
	);
}
