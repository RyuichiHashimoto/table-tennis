# フロントエンド固有ルール

> 全体ルールは `../CLAUDE.md` を参照。このファイルはフロントエンド作業時に追加で適用される。

---

## 技術スタック

- フレームワーク: Angular 18 + TypeScript 5.5（standalone components）
- スタイリング: カスタム CSS（CSS変数によるデザイントークン）
- 状態管理・API: `AppStateService`（`providedIn: 'root'` のシングルトン）
- ルーティング: Angular Router v18
- APIクライアント: `AppStateService` 内の `requestJson()` メソッド（ネイティブ fetch）
- テスト: `ng test`（Karma / Jasmine）
- チャート: Chart.js

---

## ディレクトリ構成

```
src/app/
  core/           # 設定・コアサービス（RuntimeConfig, ThemeService）
  features/       # 機能単位のモジュール群
    {feature}/
      pages/      # ページコンポーネント（ルートに対応）
      components/ # 機能内サブコンポーネント
  shared/
    ui/           # 汎用UIコンポーネント（Modal, ConfirmModal, TableShell）
  features/table-tennis/
    models/       # ドメインモデル型定義
    services/     # AppStateService
src/styles/
  ui.css          # 共通UIユーティリティクラス
```

---

## コンポーネント設計

- 1コンポーネント = `.ts` / `.html` / `.css` の3ファイル（ファイル名はkebab-case）
- すべて `standalone: true`
- propsは `@Input()` / `@Output()` で定義する
- コンポーネントは200行を超えたら分割を検討すること

```ts
// ✅ 良い例
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './example.component.html',
  styleUrl: './example.component.css',
})
export class ExampleComponent {
  @Input() title = '';
  @Input() isVisible = false;
  @Output() closed = new EventEmitter<void>();
}
```

---

## スタイリングルール

- `src/styles/ui.css` の共通クラスを優先して使う（`.ui-button`, `.ui-card`, `.ui-panel`, `.ui-chip`, `.ui-input`, `.ui-table` など）
- 色・余白などの値は CSS カスタムプロパティ（`--line`, `--bg-card`, `--text-main` など）を使う
- インラインスタイルは原則禁止（動的な値が必要な場合のみ許可）
- Tailwind CSS は使わない
- ダークモード対応は CSS変数で吸収されるため、個別の `dark:` 記述は不要

---

## 状態管理・API通信ルール

- データの取得・更新・保持はすべて `AppStateService` を通じて行う
- コンポーネントから直接 `fetch()` を呼び出さない
- `AppStateService` 内の `requestJson<T>()` メソッドが唯一のHTTPレイヤー
- APIレスポンスのフィールドは snake_case → camelCase にマッピングする（`mapMatch()` / `mapRally()` などの private メソッド）
- Angular HttpClient は使わない（ネイティブ fetch を使用）

---

## ルーティング

- ルート定義は `src/app/app.routes.ts` に集約する
- ページコンポーネントは `features/{name}/pages/` に配置する
- ルートパラメータは `:uuid` 形式で受け渡す

---

## アクセシビリティ

- `<img>` には必ず `alt` を付ける
- インタラクティブな要素には `aria-label` を付ける
- フォームの `<input>` には対応する `<label>` を付ける
- キーボード操作（Tab移動・Enterキー）が動作することを確認する

---

## 禁止事項（フロントエンド）

- `any` 型の使用禁止（どうしても必要な場合はコメントで理由を記載）
- `console.log` を本番コードに混入しない
- コンポーネント内での直接 `fetch()` 呼び出し禁止
- Angular HttpClient の使用禁止（fetch に統一）
- Tailwind CSS の使用禁止

---

## テスト方針

- ユーザーの操作を起点としたテストを書く（実装の詳細はテストしない）
- カバレッジより「重要な動作が壊れたら気づける」ことを優先する
- スナップショットテストは使わない

---

## パフォーマンス

- 重いコンポーネントは遅延ロードを検討する
- リストレンダリングには `*ngFor` の `trackBy` を適切に設定する
- 不必要なサブスクリプションを増やさない（RxJS の `takeUntilDestroyed` などで適切に解除する）
