import { useTranslation } from "react-i18next";

function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <>
      <h2>404</h2>
      <p>{t("notFound.text")}</p>
    </>
  );
}

export default NotFoundPage;
