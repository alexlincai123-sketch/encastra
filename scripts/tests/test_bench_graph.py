"""The benchmark's graphs are what their names say, and the same bytes every time."""

from __future__ import annotations

import json
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import bench_graph  # noqa: E402


class Shapes(unittest.TestCase):
    def test_a_chain_has_one_reader_and_n_minus_one_edges(self) -> None:
        graph = bench_graph.chain(1000)
        self.assertEqual(len(graph["nodes"]), 1000)
        self.assertEqual(len(graph["edges"]), 999)
        readers = [n for n, s in graph["nodes"].items() if s["component"] == bench_graph.READ]
        self.assertEqual(readers, ["n0"])
        # Every edge joins consecutive nodes, and the port types alternate text/json.
        for i, edge in enumerate(graph["edges"], start=1):
            self.assertEqual(edge["from"]["node"], f"n{i - 1}")
            self.assertEqual(edge["to"]["node"], f"n{i}")
            expected_in = "text" if i % 2 == 1 else "json"
            self.assertEqual(edge["to"]["port"], expected_in)

    def test_the_limit_case_is_one_over_the_node_ceiling(self) -> None:
        cases = dict(bench_graph.standard_cases([100]))
        limit = cases[f"limit-{bench_graph.MAX_NODES + 1}"]
        self.assertEqual(len(limit["nodes"]), bench_graph.MAX_NODES + 1)

    def test_fanout_has_one_producer_feeding_every_writer(self) -> None:
        graph = bench_graph.fanout(50)
        writers = [n for n, s in graph["nodes"].items() if s["component"] == bench_graph.WRITE]
        self.assertEqual(len(writers), 50)
        from_n1 = [e for e in graph["edges"] if e["from"]["node"] == "n1"]
        self.assertEqual(len(from_n1), 50)

    def test_wide_shares_nothing(self) -> None:
        graph = bench_graph.wide(30)
        self.assertEqual(len(graph["nodes"]), 60)
        self.assertEqual(len(graph["edges"]), 30)
        self.assertEqual(len({e["from"]["node"] for e in graph["edges"]}), 30)

    def test_the_document_and_the_graphs_are_deterministic(self) -> None:
        self.assertEqual(bench_graph.document(), bench_graph.document())
        self.assertGreater(len(bench_graph.document()), 30_000)
        self.assertEqual(json.dumps(bench_graph.chain(200)), json.dumps(bench_graph.chain(200)))

    def test_inputs_are_declared_for_every_reader(self) -> None:
        graph = bench_graph.wide(3)
        flags = bench_graph.inputs_for(graph, pathlib.Path("data.json"))
        self.assertEqual(flags.count("--input"), 3)
        self.assertIn("r2.file=data.json", flags)
