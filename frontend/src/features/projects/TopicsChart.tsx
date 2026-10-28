import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { topicIcon } from "./topicIcons";

interface TopicsChartProps {
  projectName: string;
  topics: string[];
}

const WIDTH = 640;
const HEIGHT = 440;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS = 140;
const ICON_SIZE = 28;
// Slice fill and the deeper shade used for its icon (app palette: turquoise, amber, blue, violet).
const SLICE_COLORS = [
  { fill: "#e6f8f8", ink: "#00989a" },
  { fill: "#fff4dc", ink: "#b7791f" },
  { fill: "#eaf1fc", ink: "#2f5ea8" },
  { fill: "#f2eefb", ink: "#6b4fb3" },
];

function point(angle: number, radius: number) {
  return { x: CENTER_X + radius * Math.cos(angle), y: CENTER_Y + radius * Math.sin(angle) };
}

function formatShare(count: number) {
  const share = 100 / count;

  return `${Number.isInteger(share) ? share : share.toFixed(1)}%`;
}

// "Project topics" pie from the Figma: one equal slice per topic, an icon inside each slice,
// labels around it. Slices pop in one after another; a slice slides out on hover.
function TopicsChart({ projectName, topics }: TopicsChartProps) {
  const { t } = useTranslation();
  const step = (2 * Math.PI) / topics.length;
  const share = formatShare(topics.length);

  return (
    <figure className="topics-chart">
      <figcaption>
        <strong>{projectName}</strong>
        <span>{t("project.topics")}</span>
      </figcaption>

      <svg className="topics-chart__svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        {topics.map((topic, index) => {
          const start = -Math.PI / 2 + index * step;
          const end = start + step;
          const middle = start + step / 2;
          const from = point(start, RADIUS);
          const to = point(end, RADIUS);
          const largeArc = step > Math.PI ? 1 : 0;
          const icon = point(middle, RADIUS * 0.62);
          const tickStart = point(middle, RADIUS + 4);
          const tickEnd = point(middle, RADIUS + 18);
          const label = point(middle, RADIUS + 30);
          const cos = Math.cos(middle);
          const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
          const color = SLICE_COLORS[index % SLICE_COLORS.length];
          const style = {
            "--i": index,
            "--dx": `${Math.cos(middle) * 8}px`,
            "--dy": `${Math.sin(middle) * 8}px`,
          } as CSSProperties;

          return (
            <g key={topic} className="topics-chart__slice" style={style}>
              <g className="topics-chart__wedge">
                <path
                  d={
                    topics.length === 1
                      ? `M ${CENTER_X - RADIUS} ${CENTER_Y} a ${RADIUS} ${RADIUS} 0 1 0 ${RADIUS * 2} 0 a ${RADIUS} ${RADIUS} 0 1 0 ${-RADIUS * 2} 0`
                      : `M ${CENTER_X} ${CENTER_Y} L ${from.x} ${from.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${to.x} ${to.y} Z`
                  }
                  fill={color.fill}
                />
                <path
                  className="topics-chart__icon"
                  d={topicIcon(topic)}
                  stroke={color.ink}
                  transform={`translate(${icon.x - ICON_SIZE / 2} ${icon.y - ICON_SIZE / 2}) scale(${ICON_SIZE / 24})`}
                />
              </g>
              <g className="topics-chart__caption">
                <line x1={tickStart.x} y1={tickStart.y} x2={tickEnd.x} y2={tickEnd.y} />
                <text x={label.x} y={label.y} textAnchor={anchor}>
                  <tspan className="topics-chart__label">{topic.toUpperCase()}</tspan>
                  <tspan className="topics-chart__share" x={label.x} dy="16">
                    {share}
                  </tspan>
                </text>
              </g>
            </g>
          );
        })}
        <circle className="topics-chart__outline" cx={CENTER_X} cy={CENTER_Y} r={RADIUS} />
      </svg>

      <ul className="topics-chart__list">
        {topics.map((topic) => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>
    </figure>
  );
}

export default TopicsChart;
