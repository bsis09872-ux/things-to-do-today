# 구현 상세

[← README로 돌아가기](../README.md)

## 1. 고차 함수로 데이터 다루기

할 일 목록(`todo.items`)은 직접 바꾸지 않고, 고차 함수로 **새 배열을 만들어 교체**합니다.

| 하는 일 | 사용한 함수 |
|---|---|
| 추가 · 수정 · 삭제 | 전개 연산자 `[...items, 새 할일]`, `map`, `filter` |
| 한 개 찾기 | `find` |
| 보이는 목록 만들기 | `filter`(보기 필터) → `sort`(정렬) |
| 개수 집계 | `reduce` 한 번으로 전체 · 진행중 · 완료를 동시에 계산 |
| 카드 HTML 만들기 | `map` → `join`, 템플릿 치환은 `replace`에 함수 전달 |

정렬 기준과 필터 조건은 **함수를 값으로 담은 객체**로 관리해서, 기준을 추가할 때 조건문을 늘리지 않고 객체에 항목만 추가하면 됩니다.

```js
const SORTERS = {
    regist: (a, b) => a.uid - b.uid,
    date: (a, b) => a.date.localeCompare(b.date) || a.uid - b.uid,
};

const FILTERS = {
    all: { test: () => true, ... },
    active: { test: item => !item.done, ... },
    done: { test: item => item.done, ... },
};

visible() {
    return this.items.filter(FILTERS[this.filter].test).sort(SORTERS[this.sortBy]);
}
```

## 2. 이벤트 위임과 화면 갱신 최적화

- **이벤트 위임** : 카드마다 버튼에 리스너를 붙이지 않고, 목록(`ul`) · 휴지통 · 핀 상자 · 정렬 · 필터 영역에 **리스너를 하나씩만** 연결해 `e.target.closest()`로 어떤 버튼인지 구분합니다. 카드가 새로 그려져도 리스너를 다시 연결할 필요가 없습니다.
- **필요한 만큼만 다시 그리기** : 완료 체크는 목록 전체가 아니라 **해당 카드의 속성만** 바꿔서, 불필요한 DOM 재생성을 줄이고 전환 효과도 살렸습니다.
- **템플릿 캐시** : `<script type="text/html">` 템플릿은 처음 한 번만 읽어서 재사용합니다.

## 3. 상태와 모양 분리

JS는 `data-done`, `aria-pressed`, `hidden` 같은 **속성으로 상태만 표시**하고, 어떻게 보일지는 CSS가 속성 선택자로 결정합니다. 색 · 글꼴 · 간격은 `:root` 변수(디자인 토큰)로만 관리합니다. → [배운 점 자세히](retrospective.md#배운-점--상태-처리와-보이는-모습-처리-나누기)

## 4. 예외 처리

- 사용자 입력은 화면에 넣기 전에 특수문자를 치환해 **태그 · 스크립트 실행(XSS)을 방지** → [트러블슈팅](troubleshooting.md)
- 공백만 입력한 값, 저장값이 없거나 손상된 경우, 핀 최대 개수 초과, 수정 중인 할 일을 삭제한 경우 처리
- 키보드 사용자를 위한 포커스 표시, 수정 취소 후 원래 카드로 포커스 복귀

## 폴더 구조

```
├── index.html          # 페이지 마크업 + 카드 / 휴지통 / 핀 템플릿
├── css/style.css       # 디자인 토큰 → 리셋 → 레이아웃 → 컴포넌트 → 상태 → 반응형
├── js/todo.js          # todo 객체(데이터 · 저장 · 렌더링) + 이벤트 연결
├── image/              # 파비콘 (Tdl 모노그램 SVG + PNG)
├── font/pretendard/    # 로컬 대체 폰트
└── readme/
    ├── implementation.md   # 구현 상세 (이 문서)
    ├── design.md           # 디자인
    ├── retrospective.md    # 회고
    ├── troubleshooting.md  # 트러블슈팅
    ├── credits.md          # 작업 도구 · 참고 · 출처
    └── images/             # 화면 · 트러블슈팅 캡처
```
