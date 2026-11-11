import { useState } from "react";
import { useTranslation } from "react-i18next";

import usePageTitle from "../components/layout/usePageTitle";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Icon,
  Input,
  Notice,
  ProgressBar,
  Skeleton,
  StatusPill,
  Tabs,
  TextArea,
} from "../components/ui";
import { ICON_NAMES } from "../components/ui/Icon";
import "../styles/design-system.css";

// The palette families: for each, the tokens a page uses (strong shade, text, surface).
const PALETTE: { family: string; tokens: string[] }[] = [
  {
    family: "neutral",
    tokens: [
      "--color-neutral-950",
      "--color-neutral-700",
      "--color-neutral-400",
      "--color-neutral-200",
      "--color-neutral-50",
    ],
  },
  {
    family: "accent",
    tokens: [
      "--color-accent",
      "--color-accent-hover",
      "--color-accent-text",
      "--color-accent-surface",
    ],
  },
  {
    family: "success",
    tokens: ["--color-success", "--color-success-text", "--color-success-surface"],
  },
  {
    family: "warning",
    tokens: ["--color-warning", "--color-warning-text", "--color-warning-surface"],
  },
  { family: "danger", tokens: ["--color-danger", "--color-danger-text", "--color-danger-surface"] },
  { family: "info", tokens: ["--color-info", "--color-info-text", "--color-info-surface"] },
  { family: "violet", tokens: ["--color-violet", "--color-violet-text", "--color-violet-surface"] },
];

const FONT_SIZES = ["4xl", "3xl", "2xl", "xl", "lg", "base", "md", "sm", "xs", "2xs"];

type DemoTab = "pending" | "approved" | "declined";

// The design system (#730): the palette, the type scale, the icons and every reusable component,
// each shown as the pages use it. Linked from the footer, so evaluators can find it.
function DesignSystemPage() {
  const { t } = useTranslation();

  usePageTitle(t("designSystem.title"));
  const [tab, setTab] = useState<DemoTab>("pending");
  const [text, setText] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChecked, setIsChecked] = useState(true);

  return (
    <section className="design-system">
      <header className="design-system__header">
        <h1>{t("designSystem.title")}</h1>
        <p>{t("designSystem.intro")}</p>
      </header>

      <section className="design-system__section" aria-labelledby="ds-colours">
        <h2 id="ds-colours">{t("designSystem.colours")}</h2>
        <p>{t("designSystem.coloursText")}</p>
        {PALETTE.map(({ family, tokens }) => (
          <div className="design-system__family" key={family}>
            <h3>{t(`designSystem.families.${family}`)}</h3>
            <ul className="design-system__swatches">
              {tokens.map((token) => (
                <li key={token}>
                  <span
                    className="design-system__swatch"
                    style={{ background: `var(${token})` }}
                    aria-hidden="true"
                  />
                  <code>{token}</code>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="design-system__section" aria-labelledby="ds-type">
        <h2 id="ds-type">{t("designSystem.typography")}</h2>
        <ul className="design-system__type">
          {FONT_SIZES.map((size) => (
            <li key={size}>
              <code>--font-size-{size}</code>
              <span style={{ fontSize: `var(--font-size-${size})` }}>
                {t("designSystem.sample")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="design-system__section" aria-labelledby="ds-icons">
        <h2 id="ds-icons">{t("designSystem.icons")}</h2>
        <ul className="design-system__icons">
          {ICON_NAMES.map((name) => (
            <li key={name}>
              <Icon name={name} size={28} />
              <code>{name}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="design-system__section" aria-labelledby="ds-components">
        <h2 id="ds-components">{t("designSystem.components")}</h2>

        <div className="design-system__grid">
          <Card>
            <h3>Button</h3>
            <div className="design-system__row">
              <Button>{t("designSystem.primary")}</Button>
              <Button variant="secondary">{t("designSystem.secondary")}</Button>
              <Button variant="ghost">{t("designSystem.ghost")}</Button>
            </div>
          </Card>

          <Card>
            <h3>Input · Checkbox</h3>
            <Input label={t("designSystem.inputLabel")} placeholder="Lenka" />
            <Checkbox
              label={t("designSystem.checkboxLabel")}
              checked={isChecked}
              onChange={(event) => setIsChecked(event.target.checked)}
            />
          </Card>

          <Card>
            <h3>Badge · StatusPill</h3>
            <div className="design-system__row">
              <Badge variant="accent">{t("designSystem.new")}</Badge>
              <StatusPill tone="warning">{t("review.badgePending")}</StatusPill>
              <StatusPill tone="success">{t("review.badgeApproved")}</StatusPill>
              <StatusPill tone="danger">{t("review.badgeDeclined")}</StatusPill>
            </div>
          </Card>

          <Card>
            <h3>Avatar · Icon</h3>
            <div className="design-system__row">
              <Avatar name="Lenka Husarova" avatarUrl={null} />
              <Avatar name="dkolarov" avatarUrl={null} />
              <Icon name="bell" size={28} label={t("designSystem.bell")} />
            </div>
          </Card>

          <Card>
            <h3>Notice</h3>
            <div className="design-system__stack">
              <Notice tone="info">{t("designSystem.noticeInfo")}</Notice>
              <Notice tone="success">{t("designSystem.noticeSuccess")}</Notice>
              <Notice tone="warning">{t("designSystem.noticeWarning")}</Notice>
              <Notice tone="error">{t("designSystem.noticeError")}</Notice>
            </div>
          </Card>

          <Card>
            <h3>Tabs · ProgressBar</h3>
            <Tabs
              label={t("designSystem.tabsLabel")}
              items={[
                { id: "pending", label: t("review.badgePending") },
                { id: "approved", label: t("review.badgeApproved") },
                { id: "declined", label: t("review.badgeDeclined") },
              ]}
              selected={tab}
              onSelect={setTab}
            />
            <ProgressBar
              label={t("designSystem.progressLabel")}
              value={tab === "pending" ? 1 : tab === "approved" ? 2 : 3}
              min={1}
              max={3}
            />
          </Card>

          <Card>
            <h3>TextArea</h3>
            <TextArea
              label={t("designSystem.textAreaLabel")}
              value={text}
              maxLength={120}
              rows={3}
              onChange={(event) => setText(event.target.value)}
            />
          </Card>

          <Card>
            <h3>Skeleton · EmptyState</h3>
            <Skeleton label={t("designSystem.loading")} />
            <EmptyState
              headingLevel={4}
              icon="—"
              title={t("designSystem.emptyTitle")}
              text={t("designSystem.emptyText")}
            />
          </Card>

          <Card>
            <h3>Dialog</h3>
            <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
              {t("designSystem.openDialog")}
            </Button>
            {isDialogOpen && (
              <Dialog titleId="ds-dialog-title" onClose={() => setIsDialogOpen(false)}>
                <h3 id="ds-dialog-title">{t("designSystem.dialogTitle")}</h3>
                <p>{t("designSystem.dialogText")}</p>
                <Button onClick={() => setIsDialogOpen(false)}>{t("designSystem.close")}</Button>
              </Dialog>
            )}
          </Card>
        </div>
      </section>
    </section>
  );
}

export default DesignSystemPage;
