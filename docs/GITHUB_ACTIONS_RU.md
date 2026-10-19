# GitHub Actions — ALTO

Pull Request запускает Verify ALTO: JS/JSX-контракты, DSP, Python с обязательными FFmpeg/FFprobe, настоящий Chromium UI, сборку ZIP и проверку SHA-256. Скриншоты и пакет сохраняются как artifacts. Это не живой тест Premiere.

После успешного CI объединение version.json с main автоматически запускает Build and publish ALTO. Он повторяет обязательные проверки и публикует новую версию только после их успеха. Также поддержаны тег v<version> и ручной workflow_dispatch на main с publish_release=true. На PR публикация не выполняется. Уже существующий релиз не перезаписывается.

Согласованные источники версии: version.json, window.MZ_VERSION в app.js, MZ.version в jsx/host.jsx и числовая core-версия CEP manifest без beta-суффикса. Версии с суффиксом публикуются как prerelease. JSX bundle пересобирается перед тестами и упаковкой.

Обновлятор читает GitHub Releases и точное имя Montazhopa_<version>.zip; Source code не подходит. Beta появляется при разрешённых интернете и тестовых версиях. Проверяются ZIP manifest/hashes и SHA-256; ID/форматы данных совместимы с прежними выпусками. Нативный helper устанавливает обновление после закрытия Premiere; предыдущая версия сохраняется для отката.

Не меняйте права аккаунта и не добавляйте токены для обычной публикации. Workflow использует штатный github.token с contents:write. При ошибке обязательной проверки выпуск не публикуется. Точные результаты — в GitHub Actions и docs/ALTO_4_0_QA.md.
