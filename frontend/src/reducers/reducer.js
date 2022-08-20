/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import user from "../reducers/user";
import application from "../reducers/application";
import annotations from "../reducers/annotations";
import media from "../reducers/media";

export const staticReducers = {
	application,
	user,
	media,
	annotations
}
