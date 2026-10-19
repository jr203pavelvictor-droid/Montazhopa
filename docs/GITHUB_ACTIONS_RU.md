# GitHub Actions — обновления Монтажопы

## Что происходит
- При открытии Pull Request и изменениях в main запускается **Verify Montazhopa**. Он тестирует JavaScript, модель Premiere-хоста и Python worker, собирает ZIP и проверяет SHA-256. Результат доступен как Artifact. Это не тест в настоящем Premiere.
- **Build and publish Montazhopa** собирает тот же пакет; публикация не происходит сама по себе при каждом коммите. Публикация только после проверки и явного выбора **Run workflow** → `publish_release: true` на ветке **main**, либо после создания нового тега `v...`.
- Обновлятор панели читает GitHub Releases, а не коммиты main. ZIP содержит `update-manifest.json`, поэтому источник загрузки нужно брать из **Assets** соответствующего Release.

## Первая настройка после PR
1. Проверить успешный CI в PR и нажать **Merge pull request**.
2. Открыть **Settings → Actions → General → Workflow permissions** и убедиться, что публикационному workflow доступен **Read and write permissions**. Если организация блокирует запись, GitHub сообщит об ошибке. Установку дополнительных токенов не делаем.
3. Пока `version.json` содержит `3.1.0-beta.1` и этот релиз уже существует, **не запускать публикацию**: защита остановит дублирование. Следующий выпуск потребует синхронно обновить `version.json`, `window.MZ_VERSION` в `com.victor.motionviewer/app.js`, и CEP-версию в `CSXS/manifest.xml` (без beta-суффикса).
4. Для теста без публикации нажать **Actions → Build and publish Montazhopa → Run workflow**, оставив `publish_release=false`. ZIP будет в Artifacts.
5. Для нового согласованного релиза запустить workflow с `publish_release=true` **из main** и дождаться завершения тестов и публикации.
6. В Premiere → Montazhopa → Настройки → Проверить обновления. Репозиторий: `jr203pavelvictor-droid/Montazhopa`.

## Безопасность
- Workflow не должен запускать публикацию на Pull Request.
- ZIP и SHA-256 проверяются при сборке. Не заменяйте уже опубликованный Release; повышайте версию.
- Автоматический тест не заменяет проверку в Premiere на Mac/Windows.
- Не публикуйте аккаунтные ключи, PAT и пароли в репозитории.
