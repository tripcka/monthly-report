"use client";

import { PageShell, PageTitle, SectionTitle, StatCard, StatCardRow, AutoTable, CsvTable, ImageSlot, Footer } from "./ReportUI";
import { buildNaverMediaBreakdownTable } from "../lib/channels";
import { toImgArray } from "../lib/imageUtils";

function groupHasData(group, data) {
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
  // 그룹의 유일한 내용이 이미지 하나뿐이면, 이미지 자체 라벨은 생략해서 소제목과 중복되지 않게 한다.
  const soleImageIsOnlyContent = tablesInGroup.length === 0 && imagesInGroup.length === 1;

  return (
    <>
      <SectionTitle text={group.title} />
      {tablesInGroup.map((t) => {
        const rows = data.tables[t.key];
        if (!rows || rows.length === 0) return null;
        return <AutoTable key={t.key} label={null} table={t} rows={rows} />;
      })}
      {imagesInGroup.map((img) => (
        <ImageSlot key={img.key} label={img.label} src={data.images[img.key]} showHeading={!soleImageIsOnlyContent} />
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
      {channel.kpis.length > 0 && (
        <StatCardRow>
          {channel.kpis.map((k) => (
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
  return (
    <PageShell>
      <PageTitle kicker={channel.kicker} title={channel.title} />
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
    const showOverview = channel.kpis.length > 0 || mergeGroupsWithData.length > 0 || hasOverviewImages;

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
