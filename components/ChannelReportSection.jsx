"use client";

import { PageShell, PageTitle, StatCard, StatCardRow, AutoTable, CsvTable, ImageSlot, Footer } from "./ReportUI";
import { buildNaverMediaBreakdownTable } from "../lib/channels";
import { toImgArray } from "../lib/imageUtils";

function OverviewSlide({ channel, data, hotelName }) {
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
      <Footer hotelName={hotelName} />
    </PageShell>
  );
}

function GroupSlide({ channel, group, data, hotelName }) {
  if (group.type === "mediaBreakdown") {
    const { mediaTable } = buildNaverMediaBreakdownTable(data);
    return (
      <PageShell>
        <PageTitle kicker={channel.kicker} title={group.title} />
        <CsvTable label="PC / 모바일 매체 비중" rows={mediaTable} />
        <Footer hotelName={hotelName} />
      </PageShell>
    );
  }

  const tablesInGroup = group.tableKeys.map((k) => channel.tables.find((t) => t.key === k)).filter(Boolean);
  const imagesInGroup = (group.imageKeys || [])
    .map((k) => channel.images.find((i) => i.key === k))
    .filter(Boolean);
  return (
    <PageShell>
      <PageTitle kicker={channel.kicker} title={group.title} />
      {tablesInGroup.map((t) => {
        const rows = data.tables[t.key];
        if (!rows || rows.length === 0) return null;
        return <AutoTable key={t.key} label={t.label} table={t} rows={rows} />;
      })}
      {imagesInGroup.map((img) => (
        <ImageSlot key={img.key} label={img.label} src={data.images[img.key]} />
      ))}
      <Footer hotelName={hotelName} />
    </PageShell>
  );
}

function SimpleSlide({ channel, data, hotelName }) {
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
        return <AutoTable key={t.key} label={t.label} table={t} rows={rows} />;
      })}
      {channel.images.map((img) => (
        <ImageSlot key={img.key} label={img.label} src={data.images[img.key]} />
      ))}
      <Footer hotelName={hotelName} />
    </PageShell>
  );
}

export default function ChannelReportSection({ channel, data, hotelName }) {
  if (channel.slideGroups) {
    return (
      <>
        {channel.kpis.length > 0 && <OverviewSlide channel={channel} data={data} hotelName={hotelName} />}
        {channel.slideGroups.map((group) => {
          const hasData =
            group.type === "mediaBreakdown"
              ? !!(data.tables?.pcSummary || data.tables?.moSummary)
              : group.tableKeys.some((k) => data.tables[k] && data.tables[k].length > 0) ||
                (group.imageKeys || []).some((k) => toImgArray(data.images[k]).length > 0);
          if (!hasData) return null;
          return <GroupSlide key={group.title} channel={channel} group={group} data={data} hotelName={hotelName} />;
        })}
      </>
    );
  }
  return <SimpleSlide channel={channel} data={data} hotelName={hotelName} />;
}
