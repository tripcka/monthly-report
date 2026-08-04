"use client";

import { PageShell, PageTitle, SectionTitle, StatCard, StatCardRow, AutoTable, CsvTable, ImageSlot, Footer } from "./ReportUI";
import { buildNaverMediaBreakdownTable } from "../lib/channels";
import { toImgArray } from "../lib/imageUtils";
import { normalizeInstagramPostsRows } from "../lib/postsTable";

function groupHasData(group, data) {
  if ((group.kpiKeys || []).some((key) => data.kpis?.[key])) return true;
  if ((group.kpiDetail?.keys || []).some((key) => data.kpis?.[key])) return true;
  if (group.type === "mediaBreakdown") {
    return !!(data.tables?.pcSummary?.length > 0 || data.tables?.moSummary?.length > 0);
  }
  const hasTable = (group.tableKeys || []).some((k) => data.tables[k] && data.tables[k].length > 0);
  const hasImg = (group.imageKeys || []).some((k) => toImgArray(data.images[k]).length > 0);
  return hasTable || hasImg;
}

/** 그룹 하나(표/매체비중/이미지)의 내용을 소제목("■ ...")과 함께 렌더링 */
function GroupContent({ channel, group, data }) {
  if (group.type === "mediaBreakdown") {
    const { mediaTable } = buildNaverMediaBreakdownTable(data);
    return (
      <>
        <SectionTitle text={group.title} />
        <CsvTable rows={mediaTable} />
      </>
    );
  }

  const tablesInGroup = (group.tableKeys || []).map((k) => channel.tables.find((t) => t.key === k)).filter(Boolean);
  const imagesInGroup = (group.imageKeys || []).map((k) => channel.images.find((i) => i.key === k)).filter(Boolean);

  return (
    <>
      <SectionTitle text={group.title} />
      {tablesInGroup.map((t) => {
        const sourceRows = data.tables[t.key];
        const rowIndexes = group.tableRows?.[t.key];
        let rows = rowIndexes ? rowIndexes.map((index) => sourceRows?.[index]).filter(Boolean) : sourceRows;
        if (channel.id === "instagram" && t.key === "posts") rows = normalizeInstagramPostsRows(rows);
        if (!rows || rows.length === 0) return null;
        return <AutoTable key={t.key} label={null} table={t} rows={rows} />;
      })}
      {group.kpiDetail && (
        <>
          <SectionTitle text={group.kpiDetail.title} />
          <CsvTable
            rows={[
              ["구분", "수치"],
              ...group.kpiDetail.keys.map((key) => {
                const kpi = channel.kpis.find((item) => item.key === key);
                return [kpi?.label || key, data.kpis?.[key] || "-"];
              }),
            ]}
          />
        </>
      )}
      {imagesInGroup.map((img) => (
        <ImageSlot key={img.key} label={img.label} src={data.images[img.key]} />
      ))}
    </>
  );
}

function OverviewSlide({ channel, mergeGroups, data, hotelName }) {
  const usedImageKeys = new Set((channel.slideGroups || []).flatMap((g) => g.imageKeys || []));
  const overviewImages = channel.images.filter((img) => !usedImageKeys.has(img.key));

  return (
    <PageShell>
      <PageTitle kicker={channel.kicker} title={channel.title} />
      {channel.kpis.filter((k) => !k.detailOnly).length > 0 && (
        <StatCardRow>
          {channel.kpis.filter((k) => !k.detailOnly).map((k) => (
            <StatCard key={k.key} label={k.label} value={data.kpis[k.key]} />
          ))}
        </StatCardRow>
      )}
      {mergeGroups.map((g) => (
        <GroupContent key={g.title} channel={channel} group={g} data={data} />
      ))}
      {overviewImages.map((img) => (
        <ImageSlot key={img.key} label={img.label} src={data.images[img.key]} />
      ))}
      <Footer hotelName={hotelName} />
    </PageShell>
  );
}

function GroupSlide({ channel, group, data, hotelName }) {
  const detailKpis = (group.kpiKeys || [])
    .map((key) => channel.kpis.find((k) => k.key === key))
    .filter(Boolean);
  return (
    <PageShell>
      <PageTitle kicker={channel.kicker} title={channel.title} />
      {detailKpis.length > 0 && (
        <StatCardRow>
          {detailKpis.map((k) => <StatCard key={k.key} label={k.label} value={data.kpis[k.key]} />)}
        </StatCardRow>
      )}
      <GroupContent channel={channel} group={group} data={data} />
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
    const mergeGroups = channel.slideGroups.filter((g) => g.mergeIntoOverview);
    const otherGroups = channel.slideGroups.filter((g) => !g.mergeIntoOverview);
    const mergeGroupsWithData = mergeGroups.filter((g) => groupHasData(g, data));
    const usedImageKeys = new Set(channel.slideGroups.flatMap((g) => g.imageKeys || []));
    const hasOverviewImages = channel.images.some(
      (img) => !usedImageKeys.has(img.key) && toImgArray(data.images[img.key]).length > 0
    );
    const showOverview = channel.kpis.some((k) => !k.detailOnly) || mergeGroupsWithData.length > 0 || hasOverviewImages;

    return (
      <>
        {showOverview && (
          <OverviewSlide channel={channel} mergeGroups={mergeGroupsWithData} data={data} hotelName={hotelName} />
        )}
        {otherGroups.map((group) => {
          if (!groupHasData(group, data)) return null;
          return <GroupSlide key={group.title} channel={channel} group={group} data={data} hotelName={hotelName} />;
        })}
      </>
    );
  }
  return <SimpleSlide channel={channel} data={data} hotelName={hotelName} />;
}
