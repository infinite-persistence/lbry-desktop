// @flow
import * as REACTION_TYPES from 'constants/reactions';
import * as ICONS from 'constants/icons';
import {
  SORT_COMMENTS_NEW,
  SORT_COMMENTS_BEST,
  SORT_COMMENTS_CONTROVERSIAL,
  COMMENT_PAGE_SIZE_TOP_LEVEL,
} from 'constants/comment';
import React, { useEffect } from 'react';
import classnames from 'classnames';
import CommentView from 'component/comment';
import Spinner from 'component/spinner';
import Button from 'component/button';
import Card from 'component/common/card';
import CommentCreate from 'component/commentCreate';
import usePersistedState from 'effects/use-persisted-state';
import { ENABLE_COMMENT_REACTIONS } from 'config';
import Empty from 'component/common/empty';

type Props = {
  topLevelComments: Array<Comment>,
  commentsDisabledBySettings: boolean,
  resetComments: (string) => void,
  fetchTopLevelComments: (string, number, number) => void,
  fetchReacts: (string) => Promise<any>,
  uri: string,
  claimIsMine: boolean,
  myChannels: ?Array<ChannelClaim>,
  isFetchingComments: boolean,
  linkedComment: any,
  totalComments: number,
  totalTopLevelComments: number,
  fetchingChannels: boolean,
  reactionsById: ?{ [string]: { [REACTION_TYPES.LIKE | REACTION_TYPES.DISLIKE]: number } },
  activeChannelId: ?string,
};

function CommentList(props: Props) {
  const {
    resetComments,
    fetchTopLevelComments,
    fetchReacts,
    uri,
    topLevelComments,
    commentsDisabledBySettings,
    claimIsMine,
    myChannels,
    isFetchingComments,
    linkedComment,
    totalComments,
    totalTopLevelComments,
    fetchingChannels,
    reactionsById,
    activeChannelId,
  } = props;
  const commentRef = React.useRef();
  const spinnerRef = React.useRef();
  const [sort, setSort] = usePersistedState(
    'comment-sort',
    ENABLE_COMMENT_REACTIONS ? SORT_COMMENTS_BEST : SORT_COMMENTS_NEW
  );

  // const [start] = React.useState(0);
  // const [end, setEnd] = React.useState(1);

  const [page, setPage] = React.useState(1);

  // Display comments immediately if not fetching reactions
  // If not, wait to show comments until reactions are fetched
  const [readyToDisplayComments, setReadyToDisplayComments] = React.useState(
    Boolean(reactionsById) || !ENABLE_COMMENT_REACTIONS
  );

  const linkedCommentId = linkedComment && linkedComment.comment_id;
  const hasNoComments = !totalComments;
  const moreBelow = totalTopLevelComments - topLevelComments.length > 0;

  const isMyComment = (channelId: string): boolean => {
    if (myChannels != null && channelId != null) {
      for (let i = 0; i < myChannels.length; i++) {
        if (myChannels[i].claim_id === channelId) {
          return true;
        }
      }
    }
    return false;
  };

  // const handleMoreBelow = React.useCallback(() => {
  //   if (moreBelow) {
  //     setEnd(end + 10);
  //   }
  // }, [end, setEnd, moreBelow]);

  // Fetch top-level comments
  useEffect(() => {
    console.log('fetchTopLevelComments: page:', page);
    if (page === 1) {
      resetComments(uri);
    }
    fetchTopLevelComments(uri, page, COMMENT_PAGE_SIZE_TOP_LEVEL);
  }, [fetchTopLevelComments, uri, page, resetComments]);

  useEffect(() => {
    if (totalComments && ENABLE_COMMENT_REACTIONS && !fetchingChannels) {
      fetchReacts(uri)
        .then(() => {
          setReadyToDisplayComments(true);
        })
        .catch(() => setReadyToDisplayComments(true));
    }
  }, [fetchReacts, uri, totalComments, activeChannelId, fetchingChannels]);

  useEffect(() => {
    if (readyToDisplayComments && linkedCommentId && commentRef && commentRef.current) {
      commentRef.current.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -100);
    }
  }, [readyToDisplayComments, linkedCommentId]);

  useEffect(() => {
    function handleCommentScroll(e) {
      // $FlowFixMe
      const rect = spinnerRef.current.getBoundingClientRect();

      const isInViewport =
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        // $FlowFixMe
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        // $FlowFixMe
        rect.left <= (window.innerWidth || document.documentElement.clientWidth);

      if (isInViewport) {
        // handleMoreBelow();
        if (topLevelComments.length < totalTopLevelComments) {
          console.log('setPage():', page, '-->', page + 1);
          setPage(page + 1);
        }
      }
    }

    if (!isFetchingComments && readyToDisplayComments && moreBelow && spinnerRef && spinnerRef.current) {
      window.addEventListener('scroll', handleCommentScroll);
    }

    return () => window.removeEventListener('scroll', handleCommentScroll);
  }, [moreBelow, /* handleMoreBelow, */ spinnerRef, isFetchingComments, readyToDisplayComments]);

  function prepareComments(arrayOfComments, linkedComment, isFetchingComments) {
    let orderedComments = [];

    if (linkedComment) {
      if (!linkedComment.parent_id) {
        orderedComments = arrayOfComments.filter((c) => c.comment_id !== linkedComment.comment_id);
        orderedComments.unshift(linkedComment);
      } else {
        const parentComment = arrayOfComments.find((c) => c.comment_id === linkedComment.parent_id);
        orderedComments = arrayOfComments.filter((c) => c.comment_id !== linkedComment.parent_id);

        if (parentComment) {
          orderedComments.unshift(parentComment);
        }
      }
    } else {
      orderedComments = arrayOfComments;
    }
    return orderedComments;
  }

  // // Default to newest first for apps that don't have comment reactions
  // const sortedComments = reactionsById
  //   ? sortComments({ comments: topLevelComments, reactionsById, sort, isMyComment })
  //   : [];
  // const displayedComments = readyToDisplayComments
  //   ? prepareComments(sortedComments, linkedComment).slice(start, end)
  //   : [];

  const displayedComments = readyToDisplayComments ? prepareComments(topLevelComments, linkedComment) : [];

  return (
    <Card
      title={
        totalComments > 0
          ? totalComments === 1
            ? __('1 comment')
            : __('%total_comments% comments', { total_comments: totalComments })
          : __('Leave a comment')
      }
      titleActions={
        <>
          {totalComments > 1 && ENABLE_COMMENT_REACTIONS && (
            <span className="comment__sort">
              <Button
                button="alt"
                label={__('Best')}
                icon={ICONS.BEST}
                iconSize={18}
                onClick={() => setSort(SORT_COMMENTS_BEST)}
                className={classnames(`button-toggle`, {
                  'button-toggle--active': sort === SORT_COMMENTS_BEST,
                })}
              />
              <Button
                button="alt"
                label={__('Controversial')}
                icon={ICONS.CONTROVERSIAL}
                iconSize={18}
                onClick={() => setSort(SORT_COMMENTS_CONTROVERSIAL)}
                className={classnames(`button-toggle`, {
                  'button-toggle--active': sort === SORT_COMMENTS_CONTROVERSIAL,
                })}
              />
              <Button
                button="alt"
                label={__('New')}
                icon={ICONS.NEW}
                iconSize={18}
                onClick={() => setSort(SORT_COMMENTS_NEW)}
                className={classnames(`button-toggle`, {
                  'button-toggle--active': sort === SORT_COMMENTS_NEW,
                })}
              />
            </span>
          )}
          <Button
            button="alt"
            icon={ICONS.REFRESH}
            title={__('Refresh')}
            onClick={() => {
              setPage(1);
              fetchReacts(uri);
            }}
          />
        </>
      }
      actions={
        <>
          <CommentCreate uri={uri} />

          {!commentsDisabledBySettings && !isFetchingComments && hasNoComments && (
            <Empty padded text={__('That was pretty deep. What do you think?')} />
          )}

          <ul className="comments" ref={commentRef}>
            {topLevelComments &&
              displayedComments &&
              displayedComments.map((comment) => {
                return (
                  <CommentView
                    isTopLevel
                    threadDepth={3}
                    key={comment.comment_id}
                    uri={uri}
                    authorUri={comment.channel_url}
                    author={comment.channel_name}
                    claimId={comment.claim_id}
                    commentId={comment.comment_id}
                    message={comment.comment}
                    timePosted={comment.timestamp * 1000}
                    claimIsMine={claimIsMine}
                    commentIsMine={comment.channel_id && isMyComment(comment.channel_id)}
                    linkedComment={linkedComment}
                    isPinned={comment.is_pinned}
                    supportAmount={comment.support_amount}
                    numDirectReplies={comment.replies}
                  />
                );
              })}
          </ul>

          {(isFetchingComments || moreBelow) && (
            <div className="main--empty" ref={spinnerRef}>
              <Spinner type="small" />
            </div>
          )}
        </>
      }
    />
  );
}

export default CommentList;
