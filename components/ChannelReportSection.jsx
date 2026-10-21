"use client";

import {
  PageShell,
  PageTitle,
  SectionTitle,
  StatCard,
  StatCardRow,
  AutoTable,
  CsvTable,
  ImageSlot,
  Footer,
  InvoiceReceiptsGrid,
  CardSlipsGrid,
} from "./ReportUI";
import { toImgArray } from "../lib/imageUtils";
import { normalizeInstagramPostsRows } from "../lib/postsTable";

// 이미지 슬롯 한 장표에 들어가는 최대 장수(3열 x 2행). 이걸 넘으면 같은 제목으로
// 다음 장표를 이어서 만든다 — PPTX의 layoutImageSlot 2행 제한과 맞춘 것.
const IMAGE_PAGE_LIMIT = 6;

function groupHasData(group, data) {
  if ((group.kpiKeys || []).some((key) => data.kpis?.[key])) return true;
  if ((group.kpiDetail?.keys || []).some((key) => data.kpis?.[key])) return true;
  const hasTable = (group.tableKeys || []).some((k) => data.tables[k] && data.tables[k].length > 0);
  const hasImg = (group.imageKeys || []).some((k) => toImgArray(data.images[k]).length > 0);
  return hasTable || hasImg;
}

/** 그룹 하나(표/이미지)의 내용을 소제목("■ ...")과 함께 렌더링
 * imageOverride: { [imageKey]: srcs } — 페이지 분할 시 이 장표에 보여줄 이미지만 교체 지정 (없으면 data.images 그대로 사용) */
function GroupContent({ channel, group, data, imageOverride }) {
  const tablesInGroup = (group.tableKeys || []).map((k) => channel.tables.find((t) => t.key === k)).filter(Boolean);
  const imagesInGroup = (group.imageKeys || []).map((k) => channel.images.find((i) => i.key === k)).filter(Boolean);

  function tableRowsFor(t) {
    const sourceRows = data.tables[t.key];
    const rowIndexes = group.tableRows?.[t.key];
    let rows = rowIndexes ? rowIndexes.map((index) => sourceRows?.[index]).filter(Boolean) : sourceRows;
    if (channel.id === "instagram" && t.key === "posts") rows = normalizeInstagramPostsRows(rows);
    return rows;
  }

  const renderableTables = tablesInGroup
    .map((t) => ({ t, rows: tableRowsFor(t) }))
    .filter(({ rows }) => rows && rows.length > 0);

  // invoiceReceipts/cardSlipReceipts는 표(행렬)가 아니라 파싱된 인보이스/카드전표 객체
  // 배열이라서 AutoTable 대신 전용 카드 그리드로 렌더링한다.
  function renderTableOrCards(t, rows, noBottomMargin) {
    if (t.key === "invoiceReceipts") return <InvoiceReceiptsGrid key={t.key} label={null} rows={rows} noBottomMargin={noBottomMargin} />;
    if (t.key === "cardSlipReceipts") return <CardSlipsGrid key={t.key} label={null} rows={rows} noBottomMargin={noBottomMargin} />;
    return <AutoTable key={t.key} label={null} table={t} rows={rows} noBottomMargin={noBottomMargin} />;
  }

  return (
    <>
      <SectionTitle text={group.title} />
      {group.layout === "sideBySide" && renderableTables.length > 1 ? (
        <div className="flex gap-3 items-start mb-6">
          {renderableTables.map(({ t, rows }) => (
            <div key={t.key} className="flex-1 min-w-0">
              {renderTableOrCards(t, rows, true)}
            </div>
          ))}
        </div>
      ) : (
        renderableTables.map(({ t, rows }) => renderTableOrCards(t, rows, false))
      )}
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
        <ImageSlot
          key={img.key}
          label={img.label}
          src={imageOverride && imageOverride[img.key] !== undefined ? imageOverride[img.key] : data.images[img.key]}
        />
      ))}
    </>
  );
}

/** 이미지가 IMAGE_PAGE_LIMIT을 넘어갈 때, 2번째 장표부터 "이어서" 보여주는 전용 장표
 * (표·KPI는 첫 장표에서 이미 다 보여줬으므로 여기서는 제목 + 이미지만) */
function ImageContinuationSlide({ channel, sectionTitle, label, srcs, hotelName, onRemove }) {
  return (
    <PageShell onRemove={onRemove}>
      <PageTitle kicker={channel.kicker} title={channel.title} />
      {sectionTitle ? <SectionTitle text={sectionTitle} /> : null}
      <ImageSlot label={label} src={srcs} />
      <Footer hotelName={hotelName} />
    </PageShell>
  );
}

/** 그룹 하나를 장표로 렌더링한다 — 그룹의 이미지(보통 imageKeys 1개)가 IMAGE_PAGE_LIMIT
 * 장을 넘으면, 첫 장표는 표/KPI와 함께 앞부분 이미지만 보여주고 나머지는 같은 제목으로
 * 이어지는 장표(들)에 2행씩 나눠서 보여준다. */
function renderGroupPages({ channel, group, data, hotelName, groupId, isHidden, remove }) {
  const imgKey = (group.imageKeys || [])[0];
  const allImgs = imgKey ? toImgArray(data.images[imgKey]) : [];

  if (!imgKey || allImgs.length <= IMAGE_PAGE_LIMIT) {
    if (isHidden(groupId)) return [];
    return [
      <GroupSlide key={groupId} channel={channel} group={group} data={data} hotelName={hotelName} onRemove={remove(groupId)} />,
    ];
  }

  const pages = [];
  const firstChunk = allImgs.slice(0, IMAGE_PAGE_LIMIT);
  if (!isHidden(groupId)) {
    pages.push(
      <GroupSlide
        key={groupId}
        channel={channel}
        group={group}
        data={data}
        hotelName={hotelName}
        onRemove={remove(groupId)}
        imageOverride={{ [imgKey]: firstChunk }}
      />
    );
  }

  const imgDef = channel.images.find((im) => im.key === imgKey);
  for (let start = IMAGE_PAGE_LIMIT, page = 1; start < allImgs.length; start += IMAGE_PAGE_LIMIT, page += 1) {
    const contId = `${groupId}:img${page}`;
    if (isHidden(contId)) continue;
    pages.push(
      <ImageContinuationSlide
        key={contId}
        channel={channel}
        sectionTitle={group.title}
        label={imgDef?.label}
        srcs={allImgs.slice(start, start + IMAGE_PAGE_LIMIT)}
        hotelName={hotelName}
        onRemove={remove(contId)}
      />
    );
  }

  return pages;
}

function OverviewSlide({ channel, mergeGroups, data, hotelName, onRemove }) {
  const usedImageKeys = new Set((channel.slideGroups || []).flatMap((g) => g.imageKeys || []));
  const overviewImages = channel.images.filter((img) => !usedImageKeys.has(img.key));

  return (
    <PageShell onRemove={onRemove}>
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

function GroupSlide({ channel, group, data, hotelName, onRemove, imageOverride }) {
  const detailKpis = (group.kpiKeys || [])
    .map((key) => channel.kpis.find((k) => k.key === key))
    .filter(Boolean);
  return (
    <PageShell onRemove={onRemove}>
      <PageTitle kicker={channel.kicker} title={channel.title} />
      {detailKpis.length > 0 && (
        <StatCardRow>
          {detailKpis.map((k) => <StatCard key={k.key} label={k.label} value={data.kpis[k.key]} />)}
        </StatCardRow>
      )}
      <GroupContent channel={channel} group={group} data={data} imageOverride={imageOverride} />
      <Footer hotelName={hotelName} />
    </PageShell>
  );
}

function SimpleSlide({ channel, data, hotelName, onRemove, imageOverride }) {
  return (
    <PageShell onRemove={onRemove}>
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
        <ImageSlot
          key={img.key}
          label={img.label}
          src={imageOverride && imageOverride[img.key] !== undefined ? imageOverride[img.key] : data.images[img.key]}
        />
      ))}
      <Footer hotelName={hotelName} />
    </PageShell>
  );
}

/** slideGroups가 없는 단일 장표형 채널(네이버 배너/파워컨텐츠/카카오모먼트/구글광고/당근 등)도
 * 그룹과 동일한 규칙으로 이미지가 IMAGE_PAGE_LIMIT을 넘으면 분할한다 — 첫 장표는 표/KPI와
 * 함께 앞부분 이미지만, 나머지는 이어지는 장표(들)에 나눠서 보여준다. */
function renderSimpleSlidePages({ channel, data, hotelName, simpleId, isHidden, remove }) {
  const firstPageOverride = {};
  const overflow = [];
  let hasOverflow = false;

  channel.images.forEach((img) => {
    const all = toImgArray(data.images[img.key]);
    if (all.length > IMAGE_PAGE_LIMIT) {
      hasOverflow = true;
      firstPageOverride[img.key] = all.slice(0, IMAGE_PAGE_LIMIT);
      for (let start = IMAGE_PAGE_LIMIT; start < all.length; start += IMAGE_PAGE_LIMIT) {
        overflow.push({ img, chunk: all.slice(start, start + IMAGE_PAGE_LIMIT) });
      }
    }
  });

  const pages = [];
  if (!isHidden(simpleId)) {
    pages.push(
      <SimpleSlide
        key={simpleId}
        channel={channel}
        data={data}
        hotelName={hotelName}
        onRemove={remove(simpleId)}
        imageOverride={hasOverflow ? firstPageOverride : undefined}
      />
    );
  }

  overflow.forEach(({ img, chunk }, i) => {
    const contId = `${simpleId}:img${i + 1}`;
    if (isHidden(contId)) return;
    pages.push(
      <ImageContinuationSlide
        key={contId}
        channel={channel}
        sectionTitle={null}
        label={img.label}
        srcs={chunk}
        hotelName={hotelName}
        onRemove={remove(contId)}
      />
    );
  });

  return pages;
}

export default function ChannelReportSection({ channel, data, hotelName, hiddenSlides, onToggleSlide }) {
  const isHidden = (slideId) => hiddenSlides?.has?.(slideId);
  const remove = (slideId) => (onToggleSlide ? () => onToggleSlide(slideId) : undefined);

  if (channel.slideGroups) {
    const mergeGroups = channel.slideGroups.filter((g) => g.mergeIntoOverview);
    const otherGroups = channel.slideGroups.filter((g) => !g.mergeIntoOverview);
    const mergeGroupsWithData = mergeGroups.filter((g) => groupHasData(g, data));
    const usedImageKeys = new Set(channel.slideGroups.flatMap((g) => g.imageKeys || []));
    const hasOverviewImages = channel.images.some(
      (img) => !usedImageKeys.has(img.key) && toImgArray(data.images[img.key]).length > 0
    );
    const showOverview = channel.kpis.some((k) => !k.detailOnly) || mergeGroupsWithData.length > 0 || hasOverviewImages;
    const overviewId = `${channel.id}:overview`;

    return (
      <>
        {showOverview && !isHidden(overviewId) && (
          <OverviewSlide
            channel={channel}
            mergeGroups={mergeGroupsWithData}
            data={data}
            hotelName={hotelName}
            onRemove={remove(overviewId)}
          />
        )}
        {otherGroups.flatMap((group, index) => {
          if (!groupHasData(group, data)) return [];
          const groupId = `${channel.id}:${index}:${group.title}`;
          return renderGroupPages({ channel, group, data, hotelName, groupId, isHidden, remove });
        })}
      </>
    );
  }
  const simpleId = `${channel.id}:simple`;
  return renderSimpleSlidePages({ channel, data, hotelName, simpleId, isHidden, remove });
}
