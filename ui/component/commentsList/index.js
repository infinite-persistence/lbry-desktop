import { connect } from 'react-redux';
import { makeSelectClaimIsMine, selectFetchingMyChannels, selectMyChannelClaims } from 'lbry-redux';
import {
  makeSelectTopLevelCommentsForUri,
  selectIsFetchingComments,
  makeSelectTotalCommentsCountForUri,
  makeSelectTopLevelTotalCommentsForUri,
  selectOthersReactsById,
  makeSelectCommentsDisabledForUri,
  selectMyReactionsByCommentId,
  makeSelectCommentIdsForUri,
} from 'redux/selectors/comments';
import { doCommentReset, doCommentList, doCommentReactList } from 'redux/actions/comments';
import { selectUserVerifiedEmail } from 'redux/selectors/user';
import { selectActiveChannelId } from 'redux/selectors/app';
import CommentsList from './view';

const select = (state, props) => {
  return {
    myChannels: selectMyChannelClaims(state),
    topLevelComments: makeSelectTopLevelCommentsForUri(props.uri)(state),
    totalComments: makeSelectTotalCommentsCountForUri(props.uri)(state),
    topLevelTotalComments: makeSelectTopLevelTotalCommentsForUri(props.uri)(state),
    claimIsMine: makeSelectClaimIsMine(props.uri)(state),
    isFetchingComments: selectIsFetchingComments(state),
    commentingEnabled: IS_WEB ? Boolean(selectUserVerifiedEmail(state)) : true,
    commentsDisabledBySettings: makeSelectCommentsDisabledForUri(props.uri)(state),
    fetchingChannels: selectFetchingMyChannels(state),
    commentIds: makeSelectCommentIdsForUri(props.uri)(state),
    myReactsByCommentId: selectMyReactionsByCommentId(state),
    othersReactsById: selectOthersReactsById(state),
    activeChannelId: selectActiveChannelId(state),
  };
};

const perform = (dispatch) => ({
  fetchTopLevelComments: (uri, page, pageSize, sortBy) => dispatch(doCommentList(uri, '', page, pageSize, sortBy)),
  fetchReacts: (commentIds) => dispatch(doCommentReactList(commentIds)),
  resetComments: (uri) => dispatch(doCommentReset(uri)),
});

export default connect(select, perform)(CommentsList);
