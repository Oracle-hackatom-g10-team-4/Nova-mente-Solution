#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
branch_name="$(git symbolic-ref --short HEAD)"
git check-ref-format --branch "$branch_name" >/dev/null
case "$branch_name" in main|master) echo 'Use uma branch de trabalho. Este script recusa main/master.'; exit 1;; esac
# The pinned DevKit uses a reviewed working-tree patch. Accept only that patch;
# keep rejecting dirty gitlinks, other submodules and all main-tree changes.
test -z "$(git -c submodule.integrations/chatgpt-desktop/devkit.ignore=dirty status --porcelain)" || { echo 'Commitar alterações revisáveis antes de publicar a branch.'; exit 1; }
if [ -e integrations/chatgpt-desktop/devkit/.git ] && [ -n "$(git -C integrations/chatgpt-desktop/devkit status --porcelain)" ]; then
  node integrations/chatgpt-desktop/scripts/prepare-devkit.mjs --check
fi
task_sha="$(git rev-parse HEAD)"
failed=0
for remote_name in origin team; do
  if ! git push "$remote_name" "HEAD:refs/heads/$branch_name"; then
    echo "Push falhou em $remote_name; o outro remoto será conferido."
    failed=1
    continue
  fi
  remote_sha="$(git ls-remote "$remote_name" "refs/heads/$branch_name" | cut -f1)"
  if [ "$remote_sha" != "$task_sha" ]; then echo "SHA divergente em $remote_name"; failed=1; fi
done
test "$failed" -eq 0 || { echo 'Publicação parcial; conferir remotes antes de tentar novamente. Sem force push.'; exit 1; }
echo "Branch $branch_name confirmada nos dois repositórios: $task_sha"
