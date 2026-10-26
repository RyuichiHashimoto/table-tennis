import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from table_tennis_backend.match import models
from table_tennis_backend.match.models import _apply_grouped_point_order, _insert_moved_points


def point(point_id: int, set_no: int, sort_order: float) -> SimpleNamespace:
    return SimpleNamespace(id=point_id, set_no=set_no, sort_order=sort_order)


class PointMoveLogicTest(unittest.TestCase):
    def setUp(self) -> None:
        self.target = [point(1, 4, 1), point(2, 4, 2)]
        self.moved = [point(3, 5, 3), point(4, 5, 4)]

    def test_insert_at_start_preserves_moved_order(self) -> None:
        result = _insert_moved_points(self.target, self.moved, "start", None)
        self.assertEqual([3, 4, 1, 2], [item.id for item in result])

    def test_insert_at_end_preserves_existing_points(self) -> None:
        result = _insert_moved_points(self.target, self.moved, "end", None)
        self.assertEqual([1, 2, 3, 4], [item.id for item in result])

    def test_insert_after_selected_target_point(self) -> None:
        result = _insert_moved_points(self.target, self.moved, "after", 1)
        self.assertEqual([1, 3, 4, 2], [item.id for item in result])

    def test_insert_after_rejects_another_set_point(self) -> None:
        with self.assertRaisesRegex(ValueError, "insertion point"):
            _insert_moved_points(self.target, self.moved, "after", 99)

    def test_reassigns_set_and_renumbers_all_points(self) -> None:
        points = [*self.target, *self.moved]
        grouped = {4: [self.target[0], *self.moved, self.target[1]]}
        _apply_grouped_point_order(points, grouped, {3, 4}, 4)
        self.assertEqual([4, 4, 4, 4], [item.set_no for item in points])
        ordered = sorted(points, key=lambda item: item.sort_order)
        self.assertEqual([1, 3, 4, 2], [item.id for item in ordered])
        self.assertEqual([1.0, 2.0, 3.0, 4.0], [item.sort_order for item in ordered])


class PointMoveTransactionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        models.Base.metadata.create_all(
            self.engine,
            tables=[models.Match.__table__, models.Point.__table__, models.PointMoveHistory.__table__],
        )
        with Session(self.engine) as session:
            match = models.Match(uuid="match-1", title="test", best_of=5, is_deleted=False)
            session.add(match)
            session.flush()
            for index, (set_no, winner) in enumerate([(4, "me"), (4, "op"), (5, "op")], start=1):
                session.add(models.Point(
                    uuid=f"point-{index}", match_id=match.id, set_no=set_no, server="me",
                    point_winner=winner, sort_order=float(index), receive_type="", rally_len_bucket="",
                    end_reason="test", end_side="", t_start=float(index * 10), t_end=float(index * 10 + 2),
                    is_deleted=False,
                ))
            session.commit()

    def expected_points(self) -> list[dict[str, object]]:
        with Session(self.engine) as session:
            return [
                {
                    "id": point.id,
                    "set_no": point.set_no,
                    "sort_order": point.sort_order,
                    "updated_at": point.updated_at.isoformat(),
                }
                for point in session.query(models.Point).order_by(models.Point.sort_order).all()
            ]

    def test_move_and_undo_keep_point_identity_and_video_times(self) -> None:
        expected = self.expected_points()
        with patch.object(models, "get_engine", return_value=self.engine), patch.object(models, "init_match_store"):
            history = models.move_points(
                "match-1", point_ids=[2], target_set_no=5, insertion="start",
                insert_after_point_id=None, client_operation_id="operation-1", expected_points=expected,
            )
            repeated = models.move_points(
                "match-1", point_ids=[2], target_set_no=5, insertion="start",
                insert_after_point_id=None, client_operation_id="operation-1", expected_points=expected,
            )
            self.assertEqual(history["operation_id"], repeated["operation_id"])
            with Session(self.engine) as session:
                points = session.query(models.Point).order_by(models.Point.sort_order).all()
                self.assertEqual([1, 2, 3], [point.id for point in points])
                self.assertEqual([4, 5, 5], [point.set_no for point in points])
                self.assertEqual(1, session.query(models.PointMoveHistory).count())
                moved = session.get(models.Point, 2)
                self.assertEqual((20.0, 22.0, "op"), (moved.t_start, moved.t_end, moved.point_winner))

            undone = models.undo_point_move("match-1", history["operation_id"])
            self.assertIsNotNone(undone["undone_at"])
            with Session(self.engine) as session:
                restored = session.get(models.Point, 2)
                self.assertEqual((4, 20.0, 22.0, "op"), (
                    restored.set_no, restored.t_start, restored.t_end, restored.point_winner,
                ))

    def test_invalid_insertion_rolls_back_all_changes(self) -> None:
        expected = self.expected_points()
        with patch.object(models, "get_engine", return_value=self.engine), patch.object(models, "init_match_store"):
            with self.assertRaisesRegex(ValueError, "insertion point"):
                models.move_points(
                    "match-1", point_ids=[2], target_set_no=5, insertion="after",
                    insert_after_point_id=999, client_operation_id="operation-2", expected_points=expected,
                )
        with Session(self.engine) as session:
            point_row = session.get(models.Point, 2)
            self.assertEqual((4, 2.0), (point_row.set_no, point_row.sort_order))

    def test_stale_expected_state_is_rejected(self) -> None:
        expected = self.expected_points()
        expected[0]["sort_order"] = 99.0
        with patch.object(models, "get_engine", return_value=self.engine), patch.object(models, "init_match_store"):
            with self.assertRaisesRegex(RuntimeError, "reload"):
                models.move_points(
                    "match-1", point_ids=[2], target_set_no=5, insertion="end",
                    insert_after_point_id=None, client_operation_id="operation-3", expected_points=expected,
                )


if __name__ == "__main__":
    unittest.main()
