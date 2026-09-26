# 프론트엔드 빌드 및 staging 배포

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-26
> Canonical source: GitHub repository (`.github/workflows/deploy.yml`); AWS resource definitions are owned by IaC
> Scope: GitHub Issues #10, #12

## 브랜치와 런타임 환경

- `dev`는 `agent/* → dev` PR을 통해 개발 변경을 통합하고 검증하는 Git branch다.
- `main`은 `dev → main` 승격 PR을 통과한 배포 가능 기준선이다.
- `staging`은 `main`에 반영된 commit을 배포하는 런타임 환경 개념이다.
- PR event와 `dev` push는 staging 배포를 실행하지 않는다.

## 실행 조건

현재 `.github/workflows/deploy.yml`의 실행 조건은 다음과 같다.

| 이벤트와 변경 범위 | Verification | staging 배포 |
| --- | --- | --- |
| `dev` 또는 `main` 대상 코드 PR | scope detection, workflow test, lint, test, component test, build | 실행하지 않음 |
| `dev` push의 코드 변경 | scope detection, workflow test, lint, test, component test, build | 실행하지 않음 |
| `main` push의 배포 대상 변경 | scope detection, workflow test, lint, test, component test, build | 선행 검증 성공 후 staging 배포 |
| `main` push의 검증 설정·테스트 변경 | scope detection, workflow test, lint, test, component test, build | 실행하지 않음 |
| 문서-only PR/push | scope detection과 workflow test 실행, 전체 애플리케이션 검증 생략; `verify`는 성공으로 완료 | 실행하지 않음 |
| 수동 실행 | 선택 ref에서 전체 검증 실행 | 실행하지 않음 |

문서와 검증 대상 변경이 함께 있으면 전체 검증을 실행한다. 문서 전용 변경도 workflow를 시작해 범위 감지와 workflow test를 수행한다. 전체 검증이 필요한 변경에서만 Build와 Component Test를 실행하고, `verify`가 필요한 결과를 집계해 branch required check에 제공한다. 자동 배포는 `push` event, `refs/heads/main`, 배포 대상 파일 변경과 성공한 `verify`를 모두 만족할 때만 가능하다. `docs/api/**` 또는 OpenAPI 동기화 설정 변경은 별도 `openapi-contract.yml` 검증도 실행한다.

## Job 경계

- `Build`는 checkout, dependency 설치, TypeScript/Vite build와 artifact 업로드를 담당한다.
- `Detect verification scope`는 PR base와 변경 commit 또는 push 이전·현재 commit을 비교해 전체 검증 및 배포 대상 여부를 계산한다.
- `Workflow Tests`는 변경 범위 분류 규칙을 가볍게 검증한다.
- `verify`는 workflow test를 항상 요구하고, 전체 검증 대상 변경에서는 Build와 Component Test 결과도 모두 성공해야 통과한다. 문서-only 변경에서는 전체 검증 job을 생략하고 workflow test가 통과하면 성공한다.
- `Deploy to Staging`은 `main` push에서 성공한 build artifact만 내려받아 S3 sync와 CloudFront invalidation을 수행한다.
- AWS 인증이나 배포가 실패해도 `Build` job 결과를 별도로 확인할 수 있다.
- PR에서는 AWS credential을 사용하지 않는다.
- `dev` 대상 PR과 `dev` push의 모든 job은 AWS 배포 자격 증명을 사용하지 않는다.

## Workflow에 설정된 AWS 대상

아래 값은 Frontend workflow에 이미 설정된 식별자이며 AWS resource definition의 canonical source가 아니다. Issue #10은 실제 resource rename/provisioning을 포함하지 않는다. Resource의 실제 속성, staging 연동 여부와 lifecycle은 IaC repository에서 확인해야 하며 이번 작업에서 IaC output이나 실제 AWS resource를 확인하지 않았다. 따라서 workflow의 staging 의미와 기존 식별자의 실제 연결은 별도 운영 환경 확인이 필요하다.

- Region: `ap-northeast-2`
- S3 bucket: `guardbench-dev-frontend` (기존 설정값 유지)
- CloudFront distribution: `E1PVL0Z78B1HMR`

대상 값은 현재 IaC output과 대조해야 한다. 장기적으로 workflow에 resource ID를 중복 기록하지 않고 repository/environment variable 또는 승인된 IaC output으로 연결하는 방식을 검토한다.

## AWS 인증

Workflow는 GitHub Actions OIDC와 repository secret `AWS_DEPLOY_ROLE_ARN`을 사용해 IAM role을 assume한다. AWS trust policy와 권한은 IaC가 소유하며 Frontend 문서는 이를 다시 정의하지 않는다.

## Component release workflow

`.github/workflows/component-release.yml`은 `workflow_dispatch`로만 실행한다. 입력 version을 `vMAJOR.MINOR.PATCH`로 확인하고 현재 `main` HEAD, 기존 immutable tag 여부를 검사한 뒤 새 tag와 GitHub release를 생성한다. 이 workflow 실행이나 release 생성은 해당 release 작업의 명시적 승인 범위에서만 수행한다.

## 실패 확인과 재실행

1. `Build`가 실패하면 dependency, TypeScript 또는 Vite 오류를 먼저 수정한다.
2. `Build` 성공 후 `Deploy to Staging`이 인증 단계에서 실패하면 `AWS_DEPLOY_ROLE_ARN`과 IaC의 role trust/permission 구성을 확인한다.
3. S3 sync 실패 시 대상 bucket과 IAM 권한을 확인한다.
4. CloudFront invalidation 실패 시 distribution ID와 IAM 권한을 확인한다.
5. 원인이 해결된 뒤 `main` push로 시작된 실패 run을 재실행한다. `workflow_dispatch`는 검증 전용이며 배포하지 않는다.

배포 실패를 해결하기 위해 동일한 코드의 빈 commit을 만들지 않는다.
