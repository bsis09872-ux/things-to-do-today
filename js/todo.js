/**
 * Tdl (Things to do today) - 할일 등록 / 조회 / 수정 / 삭제
 * + 등록순·날짜순 정렬, 휴지통(복구·영구삭제), 완료 표시, 전체/진행중/완료 필터
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
    all: { test: () => true, empty: "등록된 할 일이 없습니다." },
    active: { test: item => !item.done, empty: "진행 중인 할 일이 없습니다." },
    done: { test: item => item.done, empty: "완료한 할 일이 없습니다." },
};

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
    items: [],        // 할일 목록 [{ uid, date, title, content, done }]
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
        this.items = [...this.items, { uid: Date.now(), date, title, content, done: false }];
        this.commit();
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
        this.trash = this.trash.filter(item => item.uid !== uid);
        this.items = [...this.items, target];
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

    // 목록 HTML (비어 있으면 안내 문구)
    listHtml(items, tplId, emptyText) {
        return items.length
            ? items.map(item => this.toHtml(item, tplId)).join("")
            : `<li class="empty">${emptyText}</li>`;
    },

    // 화면 갱신
    render() {
        // 예전에 저장된 항목(done 없음)도 false로 맞춰서 출력
        const viewItems = this.visible().map(item => ({ ...item, done: Boolean(item.done) }));
        document.getElementById("todo-items").innerHTML =
            this.listHtml(viewItems, "tpl", FILTERS[this.filter].empty);

        document.getElementById("trash-items").innerHTML =
            this.listHtml(this.trash, "tpl-trash", "휴지통이 비어 있습니다.");

        document.getElementById("trash-count").textContent = this.trash.length;

        document.querySelectorAll(".sort-action").forEach(btn => {
            btn.setAttribute("aria-pressed", btn.dataset.sort === this.sortBy);
        });

        document.querySelectorAll(".filter-action").forEach(btn => {
            btn.setAttribute("aria-pressed", btn.dataset.filter === this.filter);
        });

        this.renderStats();
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
    const trashModal = document.getElementById("trash-modal");

    // 입력 항목(name)과 비어 있을 때 보여줄 메시지
    const fields = {
        date: "날짜를 선택하세요.",
        task: "제목을 입력하세요.",
        detail: "내용을 입력하세요.",
    };

    // 양식 초기화 + 등록 모드로 되돌리기
    const resetForm = () => {
        form.reset();
        todo.editingUid = null;
        submitBtn.textContent = "등록하기";
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

            // '전체' 보기에서는 카드 1개만 바꾸고(fade 효과 유지) 개수만 갱신,
            // '진행중'·'완료' 보기에서는 카드가 목록에서 빠져야 하므로 다시 그림
            if (todo.filter === "all") {
                btn.closest(".todo-card").dataset.done = done;
                btn.setAttribute("aria-pressed", done);
                todo.renderStats();
            } else {
                todo.render();
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
            todo.editingUid = uid;
            submitBtn.textContent = "수정하기";
            form.task.focus();
        }
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
