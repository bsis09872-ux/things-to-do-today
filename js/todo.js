/**
 * Tdl (Things to do today) - 할일 등록 / 조회 / 수정 / 삭제
 * + 등록순·날짜순 정렬, 휴지통(복구·영구삭제), 완료 표시, 전체/진행중/완료 필터
 * + 중요한 할일 핀 고정(최대 3개), 빈 목록 응원 문구
 */
const STORAGE_KEYS = {
    items: "bsi-todos",
    trash: "bsi-todos-trash",
    sortBy: "bsi-todos-sort",
    filter: "bsi-todos-filter",
};

// 정렬 기준별 비교 함수 (날짜가 같으면 등록순)
const SORTERS = {
    regist: (a, b) => a.uid - b.uid,
    date: (a, b) => a.date.localeCompare(b.date) || a.uid - b.uid,
};

// 보기 필터별 조건 함수와 목록이 비었을 때 문구
const FILTERS = {
    all: { test: () => true, empty: "등록된 할 일이 없어요" },
    active: { test: item => !item.done, empty: "진행 중인 할 일이 없어요" },
    done: { test: item => item.done, empty: "아직 완료한 할 일이 없어요" },
};

// 목록이 비었을 때 랜덤으로 보여줄 응원 문구
const CHEERS = [
    "🌱 오늘의 작은 한 걸음이 내일을 바꿔요.",
    "☕ 잠깐 숨 고르고, 천천히 시작해 볼까요?",
    "🍋 상큼하게, 다음 할 일도 가볍게!",
    "💪 할 수 있어요. 이미 잘하고 있어요.",
    "🌊 흐름을 타면 금방이에요.",
    "🍅 하나씩 해내는 게 바로 실력이에요.",
    "✨ 완벽보다 꾸준함이 이겨요.",
    "🎯 오늘 딱 하나만 끝내도 충분해요.",
    "🚀 시작이 반! 나머지 반도 금방이에요.",
    "🌈 비어 있는 칸은 새로운 가능성이에요.",
];

const pickCheer = () => CHEERS[Math.floor(Math.random() * CHEERS.length)];

// 핀 고정 최대 개수
const PIN_LIMIT = 3;

// HTML 특수문자 -> 문자 그대로 보이도록 바꿀 값
const HTML_ENTITIES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

// 사용자 입력을 화면에 넣기 전에 특수문자 치환 (태그 실행 방지)
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => HTML_ENTITIES[ch]);

const todo = {
    items: [],        // 할일 목록 [{ uid, date, title, content, done, pinnedAt }]
    trash: [],        // 휴지통 목록
    sortBy: "regist", // 정렬 기준: regist(등록순) | date(날짜순)
    filter: "all",    // 보기 필터: all(전체) | active(진행중) | done(완료)
    tpls: {},       // 템플릿 캐시 (id별로 최초 1회만 읽어서 재사용)
    editingUid: null, // 수정 중인 할일의 uid (없으면 null)

    // 할일 1개 조회
    get(uid) {
        return this.items.find(item => item.uid === uid) ?? null;
    },

    // 할일 등록
    add(date, title, content) {
        this.items = [...this.items, { uid: Date.now(), date, title, content, done: false, pinnedAt: null }];
        this.commit();
    },

    // 핀 고정된 할일 (고정한 순서대로)
    pinned() {
        return this.items
            .filter(item => item.pinnedAt != null)
            .sort((a, b) => a.pinnedAt - b.pinnedAt);
    },

    // 핀 고정 / 해제 토글. 최대 개수를 넘으면 고정하지 않고 false 반환
    togglePin(uid) {
        const target = this.get(uid);
        if (!target) return false;

        const pinning = target.pinnedAt == null;
        if (pinning && this.pinned().length >= PIN_LIMIT) return false;

        this.items = this.items.map(item =>
            item.uid === uid ? { ...item, pinnedAt: pinning ? Date.now() : null } : item
        );
        this.commit();
        return true;
    },

    // 완료 표시 토글: 목록 전체를 다시 그리지 않고 저장만 한 뒤 바뀐 상태를 돌려줌
    // (카드 1개만 화면에서 바꾸면 되므로 fade 전환 효과도 자연스럽게 보임)
    toggle(uid) {
        this.items = this.items.map(item =>
            item.uid === uid ? { ...item, done: !item.done } : item
        );
        this.save();
        return Boolean(this.get(uid)?.done);
    },

    // 할일 수정: uid가 같은 항목만 새 값으로 교체
    update(uid, date, title, content) {
        this.items = this.items.map(item =>
            item.uid === uid ? { ...item, date, title, content } : item
        );
        this.commit();
    },

    // 할일 삭제: 목록에서 빼서 휴지통으로 이동
    remove(uid) {
        const target = this.get(uid);
        if (!target) return;
        this.items = this.items.filter(item => item.uid !== uid);
        this.trash = [target, ...this.trash];
        this.commit();
    },

    // 휴지통 -> 목록으로 복구
    restore(uid) {
        const target = this.trash.find(item => item.uid === uid);
        if (!target) return;

        // 고정돼 있던 할일은 자리가 남아 있을 때만 다시 고정
        const keepPin = target.pinnedAt != null && this.pinned().length < PIN_LIMIT;

        this.trash = this.trash.filter(item => item.uid !== uid);
        this.items = [...this.items, { ...target, pinnedAt: keepPin ? target.pinnedAt : null }];
        this.commit();
    },

    // 휴지통에서 영구 삭제
    destroy(uid) {
        this.trash = this.trash.filter(item => item.uid !== uid);
        this.commit();
    },

    // 정렬 기준 변경
    setSort(sortBy) {
        if (!SORTERS[sortBy]) return;
        this.sortBy = sortBy;
        this.commit();
    },

    // 보기 필터 변경
    setFilter(filter) {
        if (!FILTERS[filter]) return;
        this.filter = filter;
        this.commit();
    },

    // 화면에 보여줄 목록: 필터 조건에 맞는 항목만 골라서 정렬 (원본 배열은 그대로)
    visible() {
        return this.items
            .filter(FILTERS[this.filter].test)
            .sort(SORTERS[this.sortBy]);
    },

    // 개수 집계: 전체 / 진행중 / 완료를 한 번에 계산
    stats() {
        return this.items.reduce(
            (acc, item) => {
                acc.all += 1;
                acc[item.done ? "done" : "active"] += 1;
                return acc;
            },
            { all: 0, active: 0, done: 0 }
        );
    },

    // 변경 사항 저장 후 화면 갱신
    commit() {
        this.save();
        this.render();
    },

    // 할일·휴지통·정렬 기준·필터 저장 (localStorage)
    save() {
        localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(this.items));
        localStorage.setItem(STORAGE_KEYS.trash, JSON.stringify(this.trash));
        localStorage.setItem(STORAGE_KEYS.sortBy, this.sortBy);
        localStorage.setItem(STORAGE_KEYS.filter, this.filter);
    },

    // 저장된 값 불러오기 (없거나 손상된 경우 기본값)
    load() {
        const readList = (key) => {
            try {
                const saved = JSON.parse(localStorage.getItem(key));
                return Array.isArray(saved) ? saved : [];
            } catch {
                return [];
            }
        };
        this.items = readList(STORAGE_KEYS.items);
        this.trash = readList(STORAGE_KEYS.trash);

        const sortBy = localStorage.getItem(STORAGE_KEYS.sortBy);
        this.sortBy = SORTERS[sortBy] ? sortBy : "regist";

        const filter = localStorage.getItem(STORAGE_KEYS.filter);
        this.filter = FILTERS[filter] ? filter : "all";
    },

    // 템플릿 조회
    getTpl(id) {
        if (!this.tpls[id]) {
            this.tpls[id] = document.getElementById(id).innerHTML;
        }
        return this.tpls[id];
    },

    // 할일 객체 -> 템플릿의 ${key} 자리에 값을 채운 HTML 문자열
    // - 정규식으로 템플릿을 한 번만 훑으면서 치환 (넣은 값이 다시 치환되지 않음)
    // - 치환 값은 함수로 돌려줘서 $&, $' 같은 특수 패턴이 해석되지 않음
    // - 사용자 입력은 escapeHtml로 바꿔 넣어 태그로 실행되지 않음
    toHtml(item, tplId) {
        return this.getTpl(tplId).replace(/\$\{(\w+)\}/g, (placeholder, key) =>
            key in item ? escapeHtml(item[key]) : placeholder
        );
    },

    // 목록 HTML (비어 있으면 emptyHtml 출력)
    listHtml(items, tplId, emptyHtml) {
        return items.length
            ? items.map(item => this.toHtml(item, tplId)).join("")
            : emptyHtml;
    },

    // 화면 출력용 값: 예전에 저장된 항목(done·pinnedAt 없음)도 기본값으로 맞춤
    toView(item) {
        return { ...item, done: Boolean(item.done), pinned: item.pinnedAt != null };
    },

    // 화면 갱신
    render() {
        const viewItems = this.visible().map(item => this.toView(item));
        document.getElementById("todo-items").innerHTML = this.listHtml(
            viewItems,
            "tpl",
            `<li class="empty">
                <p class="empty__label">${FILTERS[this.filter].empty}</p>
                <p class="empty__cheer">${pickCheer()}</p>
            </li>`
        );

        document.getElementById("trash-items").innerHTML = this.listHtml(
            this.trash,
            "tpl-trash",
            `<li class="empty">휴지통이 비어 있습니다.</li>`
        );

        this.renderPins();

        document.getElementById("trash-count").textContent = this.trash.length;

        document.querySelectorAll(".sort-action").forEach(btn => {
            btn.setAttribute("aria-pressed", btn.dataset.sort === this.sortBy);
        });

        document.querySelectorAll(".filter-action").forEach(btn => {
            btn.setAttribute("aria-pressed", btn.dataset.filter === this.filter);
        });

        this.renderStats();
        this.markEditing();
    },

    // 수정 중인 카드 표시 (목록을 다시 그려도 표시가 유지되도록 render 끝에서도 호출)
    markEditing() {
        document.querySelectorAll(".todo-card.is-editing")
            .forEach(el => el.classList.remove("is-editing"));
        if (this.editingUid !== null) {
            document.getElementById(`item-${this.editingUid}`)?.classList.add("is-editing");
        }
    },

    // 핀 상자 갱신
    renderPins() {
        const pins = this.pinned().map(item => this.toView(item));
        document.getElementById("pin-items").innerHTML = this.listHtml(
            pins,
            "tpl-pin",
            `<li class="pin-board__empty">카드의 <i class="fa-solid fa-thumbtack" aria-hidden="true"></i> 를 눌러 중요한 할 일을 고정해 보세요.</li>`
        );
        document.getElementById("pin-count").textContent = `${pins.length}/${PIN_LIMIT}`;
        document.querySelector(".pin-board").dataset.empty = pins.length === 0;
    },

    // 개수만 갱신 (완료 체크처럼 목록을 다시 그리지 않을 때도 사용)
    renderStats() {
        const stats = this.stats();
        document.querySelectorAll("[data-count]").forEach(el => {
            el.textContent = stats[el.dataset.count];
        });
    },
};

window.addEventListener("DOMContentLoaded", () => {
    const form = document.forms.frmTodo;
    const submitBtn = form.querySelector("button[type='submit']");
    const cancelBtn = form.querySelector(".cancel-edit");
    const editHint = form.querySelector(".edit-hint");
    const trashModal = document.getElementById("trash-modal");

    // 입력 항목(name)과 비어 있을 때 보여줄 메시지
    const fields = {
        date: "날짜를 선택하세요.",
        task: "제목을 입력하세요.",
        detail: "내용을 입력하세요.",
    };

    // 수정 모드 켜기/끄기: 버튼 문구·취소 버튼·안내 문구·수정 중인 카드 표시를 한 곳에서 처리
    const setEditMode = (uid) => {
        todo.editingUid = uid;
        const editing = uid !== null;
        form.dataset.mode = editing ? "edit" : "add";
        submitBtn.textContent = editing ? "수정하기" : "등록하기";
        cancelBtn.hidden = !editing;
        editHint.hidden = !editing;
        todo.markEditing();
    };

    // 양식 초기화 + 등록 모드로 되돌리기
    const resetForm = () => {
        form.reset();
        setEditMode(null);
    };

    // 수정 취소: 폼을 비우고, 수정하던 카드의 '수정' 버튼으로 포커스를 돌려줌
    const cancelEdit = () => {
        const uid = todo.editingUid;
        if (uid === null) return;
        resetForm();
        document.querySelector(`#item-${uid} .edit-action`)?.focus();
    };

    // 등록 / 수정 처리
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const emptyKey = Object.keys(fields).find(key => !form[key].value.trim());
        if (emptyKey) {
            alert(fields[emptyKey]);
            form[emptyKey].focus();
            return;
        }

        const [date, title, content] = Object.keys(fields).map(key => form[key].value.trim());

        if (todo.editingUid) {
            todo.update(todo.editingUid, date, title, content);
        } else {
            todo.add(date, title, content);
        }
        resetForm();
    });

    // 완료 / 삭제 / 수정 버튼: 목록(ul)에 리스너 1개만 연결 (이벤트 위임)
    document.getElementById("todo-items").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-uid]");
        if (!btn) return;

        const uid = Number(btn.dataset.uid);

        if (btn.classList.contains("toggle-action")) {
            const done = todo.toggle(uid);

            // '전체' 보기에서는 카드 1개만 바꾸고(fade 효과 유지) 개수·핀 상자만 갱신,
            // '진행중'·'완료' 보기에서는 카드가 목록에서 빠져야 하므로 다시 그림
            if (todo.filter === "all") {
                btn.closest(".todo-card").dataset.done = done;
                btn.setAttribute("aria-pressed", done);
                todo.renderStats();
                todo.renderPins();
            } else {
                todo.render();
            }
            return;
        }

        if (btn.classList.contains("pin-action")) {
            if (!todo.togglePin(uid)) {
                showPinNotice(`📌 핀은 최대 ${PIN_LIMIT}개까지 고정할 수 있어요.`);
            }
            return;
        }

        if (btn.classList.contains("delete-action")) {
            todo.remove(uid); // 휴지통으로 이동하므로 확인 없이 처리
            if (todo.editingUid === uid) resetForm();
            return;
        }

        if (btn.classList.contains("edit-action")) {
            const item = todo.get(uid);
            if (!item) return;
            form.date.value = item.date;
            form.task.value = item.title;
            form.detail.value = item.content;
            setEditMode(uid);
            form.scrollIntoView({ behavior: "smooth", block: "start" });
            form.task.focus({ preventScroll: true });
        }
    });

    // 핀 상자 안내 문구 (잠깐 보였다가 사라짐)
    const pinBoard = document.querySelector(".pin-board");
    const pinNotice = document.getElementById("pin-notice");
    let pinNoticeTimer = null;
    const showPinNotice = (message) => {
        pinNotice.textContent = message;
        pinBoard.classList.remove("is-shake");
        void pinBoard.offsetWidth; // 애니메이션을 처음부터 다시 재생하기 위한 리플로우
        pinBoard.classList.add("is-shake");
        clearTimeout(pinNoticeTimer);
        pinNoticeTimer = setTimeout(() => { pinNotice.textContent = ""; }, 2500);
    };

    // 핀 상자에서 항목을 누르면 목록의 해당 카드로 이동 후 잠깐 강조
    const jumpToCard = (uid) => {
        if (!todo.visible().some(item => item.uid === uid)) todo.setFilter("all");
        const card = document.getElementById(`item-${uid}`);
        if (!card) return;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.remove("is-flash");
        void card.offsetWidth;
        card.classList.add("is-flash");
        card.querySelector(".edit-action")?.focus({ preventScroll: true });
    };

    // 핀 상자 버튼 (이동 / 고정 해제): 상자(ul)에 리스너 1개 (이벤트 위임)
    document.getElementById("pin-items").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-uid]");
        if (!btn) return;

        const uid = Number(btn.dataset.uid);
        if (btn.classList.contains("jump-action")) jumpToCard(uid);
        if (btn.classList.contains("unpin-action")) todo.togglePin(uid);
    });

    // 수정 취소: 취소 버튼 클릭 또는 Esc 키 (휴지통 모달이 열려 있을 땐 모달 닫기가 우선)
    cancelBtn.addEventListener("click", cancelEdit);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !trashModal.open) cancelEdit();
    });

    // 정렬 버튼
    document.querySelector(".sort-wrap").addEventListener("click", (e) => {
        const btn = e.target.closest(".sort-action");
        if (btn) todo.setSort(btn.dataset.sort);
    });

    // 보기 필터 버튼
    document.querySelector(".filter-wrap").addEventListener("click", (e) => {
        const btn = e.target.closest(".filter-action");
        if (btn) todo.setFilter(btn.dataset.filter);
    });

    // 휴지통 열기 / 닫기
    document.getElementById("open-trash").addEventListener("click", () => trashModal.showModal());
    document.getElementById("close-trash").addEventListener("click", () => trashModal.close());

    // 휴지통 안의 복구 / 영구삭제 버튼 + 바깥(배경) 클릭 시 닫기 (이벤트 위임)
    trashModal.addEventListener("click", (e) => {
        if (e.target === trashModal) {
            trashModal.close();
            return;
        }

        const btn = e.target.closest("button[data-uid]");
        if (!btn) return;

        const uid = Number(btn.dataset.uid);

        if (btn.classList.contains("restore-action")) {
            todo.restore(uid);
        } else if (btn.classList.contains("destroy-action")) {
            if (confirm("영구 삭제하면 되돌릴 수 없습니다. 삭제할까요?")) todo.destroy(uid);
        }
    });

    // 상단 오늘 날짜 (예: 2026.11.15 · sun)
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    document.getElementById("today").textContent =
        `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} · ${days[now.getDay()]}`;

    todo.load();
    todo.render();
});
