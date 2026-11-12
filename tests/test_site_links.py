import importlib.util
import tempfile
import unittest
from pathlib import Path

src=Path(__file__).resolve().parents[1]/"scripts"/"audit-site-links.py"
spec=importlib.util.spec_from_file_location("audit_links",src)
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class SiteAuditTests(unittest.TestCase):
    def test_html_comments_are_not_real_network_imports(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/"local.js").write_text("console.log('test')")
            html="""<script src="local.js?v=5"></script>
                <!-- <script src="kaptain-script.js"></script> -->
                <a href="https://www.themoviedb.org/settings/api">API</a>
            """
            result=audit.check(root,html)
            self.assertEqual(result["issues"],[])
            self.assertEqual(result["local"],1)

    def test_missing_assets_unsafe_protocols_and_nonportable_paths(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/"okay.js").write_text("// okay")
            html="""<script src="okay.js"></script>
                <script src="lost.js"></script>
                <a href="javascript:alert(1)">danger</a>
                <a href="//kaptain.stream/studio">external</a>
                <img src="../private.jpg">
                <img src="/site-rooted.png">
                <script src="https://kaptain.stream/runtime.js"></script>
            """
            issues=audit.check(root,html)["issues"]
            self.assertGreaterEqual(len(issues),5)
            self.assertTrue(any("manquante" in x for x in issues))
            self.assertTrue(any("Kaptain" in x or "hébergeur" in x for x in issues))

if __name__=="__main__":unittest.main()
