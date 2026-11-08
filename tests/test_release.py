"""화면 자원·업데이트·저장 보호 확인: python tests/test_release.py"""
import io
import copy
import os
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
import server
import store
import updater


class ReleaseTests(unittest.TestCase):
    def test_open_dialog_starts_at_example_workbook_folder(self):
        with patch('server.WINDOW') as window:
            window.create_file_dialog.return_value = None
            self.assertIsNone(server.ask_open())
            directory = window.create_file_dialog.call_args.kwargs['directory']
            self.assertTrue((Path(directory) / '학생기초자료(예시).xlsx').is_file())

    def test_full_reset_survives_reload_and_keeps_original_files(self):
        previous = copy.deepcopy(store.STATE)
        try:
            with tempfile.TemporaryDirectory() as root:
                paths = {key: os.path.join(root, key + '.json') for key in (
                    'CONFIG_SEP', 'CONFIG_JOIN', 'CONFIG_STUDENT', 'CONFIG_ASSIGN', 'SETTINGS')}
                with patch.multiple(store, **paths):
                    original = Path(root) / 'original.xlsx'
                    exported = Path(root) / 'exported.xlsx'
                    original.write_bytes(b'original data')
                    exported.write_bytes(b'exported data')
                    student = {'반': '1', '번호': '1', '이름': '가상학생', '성별': '남', '성적': 80}
                    store.STATE.update(file_path=str(original), student_list=[student],
                                       class_data=[[student]], num_classes=1, dirty=True,
                                       sep_data=[{**student, '그룹': '1'}], join_data=[{**student, '그룹': '1'}],
                                       history=[{'data': [], 'op': None, 't': 0}], initial=[[student]])
                    store.write_json(store.SETTINGS, {'hideTour': True})
                    store.save_configs()
                    result = server.app.test_client().post('/api/reset_all').json
                    self.assertTrue(result['ok'], result)
                    store.load_configs()
                    self.assertEqual(store.STATE, store.EMPTY_STATE)
                    self.assertEqual(store.read_json(store.SETTINGS), {'hideTour': True})
                    self.assertEqual(original.read_bytes(), b'original data')
                    self.assertEqual(exported.read_bytes(), b'exported data')
        finally:
            store.STATE.clear()
            store.STATE.update(previous)

    def test_screen_resources(self):
        client = server.app.test_client()
        page = client.get('/')
        self.assertEqual(page.status_code, 200)
        assets = re.findall(r'(?:src|href)="((?:js|css|assets)/[^"]+)"', page.text)
        page.close()
        self.assertEqual(len(assets), 14)
        for asset in assets:
            response = client.get('/' + asset)
            self.assertEqual(response.status_code, 200, asset)
            self.assertNotIn('text/html', response.content_type, asset)
            response.close()
        self.assertEqual(client.get('/../student_cache.json').status_code, 404)
        with client.get('/privacy.txt') as policy:
            self.assertEqual(policy.status_code, 200)
            text = policy.data.decode('utf-8')
            self.assertTrue(text.startswith('학급 편성 프로그램 개인정보 처리방침'))
            self.assertIn('만 14세 미만 학생', text)
            self.assertIn('%APPDATA%\\학급편성', text)

    def test_new_version_and_latest(self):
        with patch.object(sys, 'frozen', True, create=True), \
                patch('updater.urllib.request.urlopen') as open_url:
            response = open_url.return_value.__enter__.return_value
            response.geturl.return_value = 'https://github.com/cordmin/ClassPlacement/releases/tag/v999.0.0'
            self.assertTrue(updater.check_update()['available'])
            response.geturl.return_value = f'https://github.com/cordmin/ClassPlacement/releases/tag/v{updater.APP_VERSION}'
            self.assertEqual(updater.check_update()['status'], 'latest')
            open_url.side_effect = TimeoutError('offline')
            self.assertEqual(updater.check_update()['status'], 'error')

    def test_invalid_tag_never_downloads(self):
        with patch('updater.urllib.request.urlopen') as open_url:
            for tag in ('../bad', 'v3.1.0/evil', 'v3%2f1', None):
                with self.assertRaises(ValueError):
                    updater.start_install(tag, '.')
            open_url.assert_not_called()

    def test_install_launch_and_restart_environment(self):
        with tempfile.TemporaryDirectory() as root, \
                patch('updater.tempfile.mkdtemp', return_value=root), \
                patch('updater.urllib.request.urlopen') as open_url, \
                patch('updater.subprocess.Popen') as launch:
            open_url.return_value.__enter__.return_value = io.BytesIO(b'test installer')
            updater.start_install('v3.1.0', root)
            self.assertEqual((Path(root) / updater.SETUP_ASSET).read_bytes(), b'test installer')
            args, kwargs = launch.call_args
            self.assertIn('/VERYSILENT', args[0])
            self.assertEqual(kwargs['env']['PYINSTALLER_RESET_ENVIRONMENT'], '1')
            self.assertEqual(open_url.call_args.kwargs['timeout'], 30)

    def test_download_failure_does_not_launch(self):
        with patch('updater.urllib.request.urlopen', side_effect=TimeoutError()), \
                patch('updater.subprocess.Popen') as launch:
            with self.assertRaises(TimeoutError):
                updater.start_install('v3.1.0', '.')
            launch.assert_not_called()

    def test_failed_save_prevents_update_and_exit(self):
        with patch('server.save_configs', side_effect=OSError('disk full')), \
                patch('server.updater.start_install') as install, \
                patch('server.quit_app') as quit_app, \
                patch('server.traceback.print_exc'):
            result = server.app.test_client().post('/api/update/install', json={'version': 'v3.1.0'}).json
            self.assertFalse(result['ok'])
            install.assert_not_called()
            quit_app.assert_not_called()

    def test_failed_json_write_keeps_previous_file(self):
        with tempfile.TemporaryDirectory() as root:
            path = os.path.join(root, 'saved.json')
            store.write_json(path, {'saved': True})
            with self.assertRaises(TypeError):
                store.write_json(path, {'invalid': object()})
            self.assertEqual(store.read_json(path), {'saved': True})
            self.assertEqual(os.listdir(root), ['saved.json'])


if __name__ == '__main__':
    unittest.main()
