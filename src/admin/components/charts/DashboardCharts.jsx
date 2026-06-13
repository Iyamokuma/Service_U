import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, CHART_COLORS } from "./chartUtils.jsx";

/** Vertical histogram — daily registration counts with hover details. */
export function TrendHistogram({ data, height = 260 }) {
  const rows = (data || []).map((r) => ({
    label: r.day
      ? new Date(String(r.day) + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "",
    count: Number(r.cnt ?? 0),
    day: r.day,
  }));

  if (!rows.length) {
    return <div className="sa-text-muted sa-text-sm">No trend data yet.</div>;
  }

  return (
    <div className="sa-recharts-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={36} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const day = payload[0]?.payload?.day;
              return (
                <ChartTooltip
                  active
                  label={
                    day
                      ? new Date(day + "T12:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : label
                  }
                  payload={[{ name: "Applications", value: payload[0].value, color: CHART_COLORS.blue }]}
                />
              );
            }}
          />
          <Bar dataKey="count" name="Applications" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bar histogram — counts by category (e.g. service unit). */
export function CategoryHistogram({ rows, labelKey = "label", valueKey = "count", height = 320 }) {
  const data = (rows || []).map((r) => ({
    label: String(r[labelKey] ?? r.unit_name ?? ""),
    count: Number(r[valueKey] ?? r.cnt ?? 0),
  }));

  if (!data.length) {
    return <div className="sa-text-muted sa-text-sm">No data for current filters.</div>;
  }

  const chartHeight = Math.max(height, data.length * 36);

  return (
    <div className="sa-recharts-wrap" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.25)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11, fill: "#334155" }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload;
              return (
                <ChartTooltip
                  active
                  label={row?.label}
                  payload={[{ name: "Applications", value: row?.count, color: CHART_COLORS.violet }]}
                />
              );
            }}
          />
          <Bar dataKey="count" name="Applications" fill={CHART_COLORS.violet} radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut / pie with hover segment details. */
export function StatusPieChart({ distribution, compact }) {
  const entries = [
    { key: "new", label: "New", color: CHART_COLORS.new },
    { key: "in_progress", label: "In progress", color: CHART_COLORS.progress },
    { key: "overdue", label: "Overdue", color: CHART_COLORS.overdue },
    { key: "accepted", label: "Accepted", color: CHART_COLORS.accepted },
    { key: "rejected", label: "Rejected", color: CHART_COLORS.rejected },
  ];
  const data = entries
    .map((e) => ({ name: e.label, value: distribution[e.key] || 0, fill: e.color, key: e.key }))
    .filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!total) {
    return <div className="sa-donut-empty sa-text-muted sa-text-sm">No registrations in scope yet.</div>;
  }

  return (
    <div className={`sa-donut-row${compact ? " sa-donut-row--compact" : ""}`}>
      <div
        className="sa-recharts-wrap sa-recharts-donut"
        style={{ height: compact ? 160 : 200, minWidth: compact ? 160 : 200 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={compact ? 42 : 52}
              outerRadius={compact ? 62 : 78}
              paddingAngle={2}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                const pct = total ? Math.round((Number(p.value) / total) * 100) : 0;
                return (
                  <ChartTooltip
                    active
                    label={p.name}
                    payload={[
                      { name: "Count", value: p.value, color: p.payload?.fill },
                      { name: "Share", value: `${pct}%`, color: p.payload?.fill },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="sa-donut-legend">
        {entries.map((e) => (
          <li key={e.key}>
            <span className="sa-donut-dot" style={{ background: e.color }} />
            <span>{e.label}</span>
            <strong>{distribution[e.key] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Gender breakdown horizontal bars with tooltips. */
export function GenderHistogram({ sexMap, height = 120 }) {
  const data = Object.entries(sexMap || {}).map(([label, count]) => ({ label, count: Number(count) }));
  if (!data.length) {
    return <div className="sa-text-muted sa-text-sm">No data yet.</div>;
  }

  return (
    <div className="sa-recharts-wrap" style={{ height: Math.max(height, data.length * 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 11, fill: "#334155" }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload;
              return (
                <ChartTooltip
                  active
                  label={row?.label}
                  payload={[{ name: "Applicants", value: row?.count, color: CHART_COLORS.blue }]}
                />
              );
            }}
          />
          <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
