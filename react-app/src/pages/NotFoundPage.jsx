import { Link } from "react-router-dom";

// 既存アプリには無かった画面。存在しないパスへのアクセス用に新規追加。
function NotFoundPage() {
  return (
    <section className="page-placeholder">
      <p>お探しのページが見つかりませんでした。</p>
      <div className="actions">
        <Link to="/" className="button-link">
          ホームへ戻る
        </Link>
      </div>
    </section>
  );
}

export default NotFoundPage;
