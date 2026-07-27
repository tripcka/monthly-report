"use client";

import { PageShell, PageTitle, StatCard, StatCardRow, CsvTable, ImageSlot, Footer } from "./ReportUI";

export default function ChannelReportSection({ channel, data, hotelName }) {
  return (
    <PageShell>
      <PageTitle kicker={channel.kicker} title={channel.title} />

      {channel.kpis.length > 0 && (
        <StatCardRow>
          {channel.kpis.map((k) => (
            <StatCard key={k.key} label={k.label} value={data.kpis[k.key]} />
          ))}
        </StatCardRow>
      )}

      {channel.tables.map((t) => {
        const rows = data.tables[t.key];
        if (!rows || rows.length === 0) return null;
        return <CsvTable key={t.key} label={t.label} rows={rows} />;
      })}

      {channel.images.map((img) => (
        <ImageSlot key={img.key} label={img.label} src={data.images[img.key]} />
      ))}

      <Footer hotelName={hotelName} />
    </PageShell>
  );
}
