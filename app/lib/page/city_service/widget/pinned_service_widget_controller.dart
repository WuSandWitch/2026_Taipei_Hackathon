import 'package:get/get.dart';
import 'package:town_pass/page/city_service/model/my_service_model.dart';

class PinnedServiceWidgetController extends GetxController {
  final RxList<MyServiceItemId> _pinnedList = RxList(
    [
      // 預設釘 3 個 +「新增」剛好一排 4 格。原本的「市政資訊儀表板」標題太長，
      // 被擠到第 4 欄會超出螢幕；它仍在「更多」與「熱門」裡。
      MyServiceItemId.busAssist,
      MyServiceItemId.locationSearch,
      MyServiceItemId.districtOffice,
    ],
  );

  RxList<MyServiceItemId> get pinnedList => _pinnedList;

  bool remove(MyServiceItemId itemId) {
    return _pinnedList.remove(itemId);
  }

  bool replaceWith(List<MyServiceItemId> list) {
    if (list.isNotEmpty) {
      _pinnedList.value = list;
      return true;
    }
    return false;
  }

  bool push(MyServiceItemId itemId) {
    if (_pinnedList.length < 12) {
      _pinnedList.add(itemId);
      return true;
    }
    return false;
  }
}
