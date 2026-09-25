# 프론트엔드 빌드 및 dev 배포

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`.github/workflows/deploy.yml`); AWS resource definitions are owned by IaC
> Scope: GitHub Issue #10

## 실행 조건

현재 `.github/workflows/deploy.yml`의 실행 조건은 다음과 같다.

| 이벤트 | Build | dev 배포 |
| --- | --- | --- |
| `dev` 또는 `main` 대상 PR | 실행 | 실행하지 않음 |
| `main` push | 실행 | Build 성공 후 실행 |
| 수동 실행 | 실행 | Build 성공 후 실행 |
| `docs/**` 또는 Markdown-only PR/push | 실행하지 않음 | 실행하지 않음 |

문서와 코드가 함께 변경되면 일반 코드 변경으로 취급한다. 수동 실행은 path filter와 관계없이 현재 `main` 또는 실행 시 선택한 ref를 빌드하고 dev에 배포한다.

## Job 경계

- `Build`는 checkout, dependency 설치, TypeScript/Vite build와 artifact 업로드를 담당한다.
- `Deploy to Dev`는 성공한 build artifact만 내려받아 S3 sync와 CloudFront invalidation을 수행한다.
- AWS 인증이나 배포가 실패해도 `Build` job 결과를 별도로 확인할 수 있다.
- PR에서는 AWS credential을 사용하지 않는다.

## Workflow에 설정된 AWS 대상

아래 값은 Frontend workflow의 현재 configuration이며 AWS resource definition의 canonical source가 아니다. Resource의 실제 속성과 lifecycle은 IaC repository에서 관리한다. 이번 문서 검토에서는 IaC output을 확인하지 않았다.

- Region: `ap-northeast-2`
- S3 bucket: `guardbench-dev-frontend`
- CloudFront distribution: `E1PVL0Z78B1HMR`

대상 값은 현재 IaC output과 대조해야 한다. 장기적으로 workflow에 resource ID를 중복 기록하지 않고 repository/environment variable 또는 승인된 IaC output으로 연결하는 방식을 검토한다.

## AWS 인증

Workflow는 GitHub Actions OIDC와 repository secret `AWS_DEPLOY_ROLE_ARN`을 사용해 IAM role을 assume한다. AWS trust policy와 권한은 IaC가 소유하며 Frontend 문서는 이를 다시 정의하지 않는다.

## Component release workflow

`.github/workflows/component-release.yml`은 `workflow_dispatch`로만 실행한다. 입력 version을 `vMAJOR.MINOR.PATCH`로 확인하고 현재 `main` HEAD, 기존 immutable tag 여부를 검사한 뒤 새 tag와 GitHub release를 생성한다. 이 workflow 실행이나 release 생성은 해당 release 작업의 명시적 승인 범위에서만 수행한다.

## 실패 확인과 재실행

1. `Build`가 실패하면 dependency, TypeScript 또는 Vite 오류를 먼저 수정한다.
2. `Build` 성공 후 `Deploy to Dev`가 인증 단계에서 실패하면 `AWS_DEPLOY_ROLE_ARN`과 IaC의 role trust/permission 구성을 확인한다.
3. S3 sync 실패 시 대상 bucket과 IAM 권한을 확인한다.
4. CloudFront invalidation 실패 시 distribution ID와 IAM 권한을 확인한다.
5. 원인이 해결된 뒤 실패한 run을 재실행하거나 `workflow_dispatch`로 명시적으로 다시 배포한다.

배포 실패를 해결하기 위해 동일한 코드의 빈 commit을 만들지 않는다.
