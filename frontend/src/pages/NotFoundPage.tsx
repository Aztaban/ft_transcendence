import { useTranslation } from "react-i18next";

import usePageTitle from "../components/layout/usePageTitle";

function NotFoundPage() {
  const { t } = useTranslation();

  usePageTitle(t("pageTitle.notFound"));

  return (
    <>
      <h1>404</h1>
      <p>{t("notFound.text")}</p>
    </>
  );
}

export default NotFoundPage;
